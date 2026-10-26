/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaywayClient, PaywayPaymentLinkInput } from './payway.client';

describe('PaywayClient', () => {
  const input: PaywayPaymentLinkInput = {
    description: 'Orden order-1',
    totalPrice: 2500.49,
    successUrl: 'https://front.test/success?orderId=order-1',
    cancelUrl: 'https://front.test/failure?orderId=order-1',
    notificationsUrl: 'https://api.test/payments/payway/webhook?attempt=a-1',
  };

  const response = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    }) as unknown as Response;

  const createClient = (overrides: Record<string, string> = {}) => {
    const values: Record<string, string> = {
      PAYWAY_PUBLIC_KEY: 'public-key',
      PAYWAY_PRIVATE_KEY: 'private-key',
      PAYWAY_SITE_ID: '12345678',
      ...overrides,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new PaywayClient(config);
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('reporta si esta configurado segun las claves y el site', () => {
    expect(createClient().isConfigured()).toBe(true);
    expect(createClient({ PAYWAY_PRIVATE_KEY: '' }).isConfigured()).toBe(false);
    expect(createClient({ PAYWAY_SITE_ID: '  ' }).isConfigured()).toBe(false);
  });

  it('crea el link contra sandbox con apikey privada y cuerpo del formulario', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(200, { id: 'link-1' }));

    const result = await createClient().createPaymentLink(input);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://developers.decidir.com/api/v1/checkout-payment-button/link',
    );
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('apikey')).toBe('private-key');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(
      JSON.parse(Buffer.from(headers.get('X-Source')!, 'base64').toString()),
    ).toMatchObject({
      service: 'SDK-NODE',
    });

    expect(JSON.parse(init?.body as string)).toEqual({
      origin_platform: 'SDK-Node',
      payment_description: 'Orden order-1',
      currency: 'ARS',
      total_price: 2500.49,
      site: '12345678',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      notifications_url: input.notificationsUrl,
      template_id: 1,
      installments: [1],
      plan_gobierno: false,
      public_apikey: 'public-key',
      auth_3ds: false,
    });
    expect(result).toEqual({
      paymentId: 'link-1',
      checkoutUrl: 'https://developers.decidir.com/web/checkout/link-1',
    });
  });

  it('usa los hosts de produccion y respeta cuotas, template y 3DS configurados', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(200, { id: 'link-2' }));

    const result = await createClient({
      PAYWAY_ENV: 'production',
      PAYWAY_INSTALLMENTS: '1, 3,6',
      PAYWAY_TEMPLATE_ID: '2',
      PAYWAY_AUTH_3DS: 'true',
    }).createPaymentLink(input);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://ventasonline.payway.com.ar/api/v1/checkout-payment-button/link',
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string),
    ).toMatchObject({
      installments: [1, 3, 6],
      template_id: 2,
      auth_3ds: true,
    });
    expect(result.checkoutUrl).toBe(
      'https://live.decidir.com/web/checkout/link-2',
    );
  });

  it('lee payment_link y toma el id del ultimo segmento de la URL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      response(201, {
        payment_link: 'https://developers.decidir.com/web/checkout/ABC123',
      }),
    );

    const result = await createClient().createPaymentLink(input);

    expect(result).toEqual({
      paymentId: 'ABC123',
      checkoutUrl: 'https://developers.decidir.com/web/checkout/ABC123',
    });
  });

  it('prefiere la url completa que devuelva Payway', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { id: 'link-3', url: 'https://pay.test/form/link-3' }),
      );

    const result = await createClient().createPaymentLink(input);

    expect(result.checkoutUrl).toBe('https://pay.test/form/link-3');
  });

  it('falla con 502 si Payway rechaza la solicitud y no filtra claves en el log', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(401, { apikey: 'secret-value', error: 'x' }),
      );
    const client = createClient();
    const errorSpy = jest
      .spyOn((client as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(client.createPaymentLink(input)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(errorSpy.mock.calls[0][0]).not.toContain('secret-value');
  });

  it('falla con 502 si la respuesta no trae id ni url', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(response(200, {}));

    await expect(
      createClient().createPaymentLink(input),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('falla con 503 si falta configuracion', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(
      createClient({ PAYWAY_PRIVATE_KEY: '' }).createPaymentLink(input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('traduce timeout y errores de red', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(timeout);

    await expect(
      createClient().createPaymentLink(input),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);

    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(
      createClient().createPaymentLink(input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
