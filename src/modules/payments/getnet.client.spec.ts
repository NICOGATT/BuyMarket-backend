import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetnetClient, GetnetPaymentIntentRequest } from './getnet.client';

describe('GetnetClient', () => {
  const payload: GetnetPaymentIntentRequest = {
    mode: 'instant',
    order_id: 'order-1',
    configurations: {
      '3ds': true,
      preauthorization: false,
      card_verification: false,
      success_url: 'https://front.test.com/getnet/success',
      error_url: 'https://front.test.com/getnet/error',
    },
    payment: { currency: 'ARS', amount: 10000 },
    product: [
      {
        product_type: 'physical_goods',
        title: 'Producto',
        value: 10000,
        quantity: 1,
      },
    ],
    customer: {
      customer_id: 'customer-1',
      first_name: 'Nico',
      last_name: 'Gatti',
      name: 'Nico Gatti',
      document_type: 'DNI',
      checked_email: true,
    },
    expires_at: '1h',
  };

  const response = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
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

  it('autentica con form-urlencoded, crea intents y reutiliza el token', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-1' }))
      .mockResolvedValueOnce(response(201, { payment_intent_id: 'intent-2' }));
    const client = createClient();

    await expect(client.createPaymentIntent(payload)).resolves.toEqual({
      payment_intent_id: 'intent-1',
    });
    await expect(client.createPaymentIntent(payload)).resolves.toEqual({
      payment_intent_id: 'intent-2',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
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

    const intentRequest = fetchMock.mock.calls[1];
    expect(intentRequest[0]).toBe(
      'https://api.pre.globalgetnet.com/dpy/web-checkout/v1/payment-intent',
    );
    expect(new Headers(intentRequest[1]?.headers).get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(intentRequest[1]?.body).toBe(JSON.stringify(payload));
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

    await expect(createClient().createPaymentIntent(payload)).resolves.toEqual({
      payment_intent_id: 'intent-1',
    });
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

  it('traduce errores del proveedor y respuestas sin intent id', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(500, {}));

    await expect(
      createClient().createPaymentIntent(payload),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('expone el loader de iframe del ambiente configurado', () => {
    expect(createClient().getLoaderUrl()).toBe(
      'https://www.pre.globalgetnet.com/digital-checkout/loader.js',
    );
  });
});
