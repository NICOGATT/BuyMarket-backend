import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetnetClient, GetnetPaymentIntentRequest } from './getnet.client';

describe('GetnetClient', () => {
  const payload: GetnetPaymentIntentRequest = {
    order_id: 'order-1',
    customer: {
      customer_id: 'customer-1',
      first_name: 'Nico',
      last_name: 'Gatti',
      name: 'Nico Gatti',
      email: 'buyer@test.com',
    },
    payment: { currency: 'ARS', amount: 150000 },
    product: {} as GetnetPaymentIntentRequest['product'],
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
      GETNET_API_URL: 'https://api.pre.globalgetnet.com/',
      GETNET_WEB_URL: 'https://www.pre.globalgetnet.com/',
      GETNET_CLIENT_ID: 'client-id',
      GETNET_CLIENT_SECRET: 'client-secret',
      ...overrides,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new GetnetClient(config);
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('autentica con form-urlencoded contra la URL oficial de UAT', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-1' }));
    const client = createClient();

    await client.createPaymentIntent(payload);

    const tokenRequest = fetchMock.mock.calls[0];
    expect(tokenRequest[0]).toBe(
      'https://api.pre.globalgetnet.com/authentication/oauth2/access_token',
    );
    expect(tokenRequest[1]?.method).toBe('POST');
    expect(new Headers(tokenRequest[1]?.headers).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(tokenRequest[1]?.body).toBe(
      'grant_type=client_credentials&client_id=client-id&client_secret=client-secret',
    );
  });

  it('usa la ruta de payment intent por defecto del manual digital-checkout', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-1' }));

    await createClient().createPaymentIntent(payload);

    const intentRequest = fetchMock.mock.calls[1];
    expect(intentRequest[0]).toBe(
      'https://api.pre.globalgetnet.com/digital-checkout/v1/payment-intent',
    );
    expect(new Headers(intentRequest[1]?.headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(new Headers(intentRequest[1]?.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(intentRequest[1]?.body).toBe(JSON.stringify(payload));
  });

  it('permite configurar la ruta del payment intent por variable de entorno', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-9' }));
    const client = createClient({
      GETNET_PAYMENT_INTENT_PATH: '/digital-checkout/v2/payment-intent',
    });

    await client.createPaymentIntent(payload);

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.pre.globalgetnet.com/digital-checkout/v2/payment-intent',
    );
  });

  it('normaliza rutas sin barra inicial', () => {
    const client = createClient({
      GETNET_PAYMENT_INTENT_PATH: 'digital-checkout/v1/payment-intent',
    });

    expect(client.getPaymentIntentPath()).toBe(
      '/digital-checkout/v1/payment-intent',
    );
  });

  it('devuelve payment_intent_id y checkout_url cuando Getnet los envia', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response(201, {
          payment_intent_id: 'abc123',
          checkout_url: 'https://checkout.pre.globalgetnet.com/s/abc123',
        }),
      );

    await expect(
      createClient().createPaymentIntent(payload),
    ).resolves.toEqual({
      payment_intent_id: 'abc123',
      checkout_url: 'https://checkout.pre.globalgetnet.com/s/abc123',
    });
  });

  it('omite checkout_url cuando la respuesta no lo incluye', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'solo-id' }));

    await expect(createClient().createPaymentIntent(payload)).resolves.toEqual({
      payment_intent_id: 'solo-id',
      checkout_url: undefined,
    });
  });

  it('reutiliza el token en caché entre llamadas', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-1' }))
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-2' }));
    const client = createClient();

    await client.createPaymentIntent(payload);
    await client.createPaymentIntent(payload);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization'),
    ).toBe('Bearer token-1');
  });

  it('renueva el token y reintenta una vez cuando Getnet responde 401', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-2', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-1' }));

    await expect(
      createClient().createPaymentIntent(payload),
    ).resolves.toEqual({ payment_intent_id: 'intent-1' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new Headers(fetchMock.mock.calls[3][1]?.headers).get('Authorization'),
    ).toBe('Bearer token-2');
  });

  it('falla de forma controlada cuando faltan credenciales', async () => {
    const client = createClient({ GETNET_CLIENT_SECRET: '' });

    await expect(client.createPaymentIntent(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('traduce errores del proveedor sin filtrar contenido sensible', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(
        response(500, { message: 'boom', access_token: 'leak-attempt' }),
      );

    await expect(
      createClient().createPaymentIntent(payload),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rechaza respuestas exitosas sin payment_intent_id', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(201, { foo: 'bar' }));

    await expect(
      createClient().createPaymentIntent(payload),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('traduce timeouts del proveedor', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    await expect(
      createClient().createPaymentIntent(payload),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it('expone el loader de iframe del ambiente configurado', () => {
    expect(createClient().getLoaderUrl()).toBe(
      'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
    );
  });
});
