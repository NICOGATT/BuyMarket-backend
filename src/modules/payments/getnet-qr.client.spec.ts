import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetnetQrClient } from './getnet-qr.client';

describe('GetnetQrClient', () => {
  const response = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  const createClient = (overrides: Record<string, string> = {}) => {
    const values: Record<string, string> = {
      GETNET_QR_ENABLED: 'true',
      GETNET_QR_API_URL: 'https://api.pre.globalgetnet.com/',
      GETNET_QR_CLIENT_ID: 'client-id',
      GETNET_QR_CLIENT_SECRET: 'client-secret',
      GETNET_QR_SELLER_ID: 'seller-id',
      GETNET_QR_WEBHOOK_URL: 'https://api.test/payments/getnet-qr/webhook',
      ...overrides,
    };
    return new GetnetQrClient({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);
  };

  beforeEach(() => jest.restoreAllMocks());

  it('crea un QR con Basic OAuth y headers de Global API', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(
        response(201, {
          data: {
            payment_id: 'payment-1',
            qr_code: '000201payload',
            expires_at: '2026-07-22T20:00:00.000Z',
          },
        }),
      );
    const client = createClient();

    await expect(
      client.createPayment({
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        orderId: 'order-1',
        paymentId: 'local-payment-1',
        amount: 150000,
        customerId: 'customer-1',
        customerEmail: 'buyer@test.com',
      }),
    ).resolves.toMatchObject({
      paymentId: 'payment-1',
      qrPayload: '000201payload',
    });

    const tokenHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(tokenHeaders.get('Authorization')).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
    );
    const qrRequest = fetchMock.mock.calls[1];
    expect(qrRequest[0]).toBe(
      'https://api.pre.globalgetnet.com/dpm/payments-gwproxy/v2/payments/qrcode',
    );
    const qrHeaders = new Headers(qrRequest[1]?.headers);
    expect(qrHeaders.get('Authorization')).toBe('Bearer token');
    expect(qrHeaders.get('x-seller-id')).toBe('seller-id');
    const qrBody = qrRequest[1]?.body;
    expect(typeof qrBody).toBe('string');
    expect(JSON.parse(qrBody as string)).toMatchObject({
      idempotency_key: 'idem-1',
      order_id: 'order-1',
      data: { amount: 150000, currency: 'ARS' },
    });
  });

  it('consulta y normaliza el estado autoritativo del pago', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(
        response(200, {
          payment_id: 'payment-1',
          order_id: 'order-1',
          status: 'APPROVED',
          amount: 10000,
          currency: 'ARS',
        }),
      );

    await expect(createClient().getPayment('payment-1')).resolves.toEqual({
      paymentId: 'payment-1',
      orderId: 'order-1',
      qrPayload: undefined,
      expiresAt: undefined,
      status: 'APPROVED',
      amount: 10000,
      currency: 'ARS',
    });
  });

  it('renueva el token y reintenta una vez ante 401', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-1', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(
        response(200, { access_token: 'token-2', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(
        response(200, { payment_id: 'payment-1', status: 'PENDING' }),
      );

    await createClient().getPayment('payment-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new Headers(fetchMock.mock.calls[3][1]?.headers).get('Authorization'),
    ).toBe('Bearer token-2');
  });

  it('falla si Getnet no devuelve un payload QR', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        response(200, { access_token: 'token', expires_in: 3599 }),
      )
      .mockResolvedValueOnce(response(201, { payment_id: 'payment-1' }));

    await expect(
      createClient().createPayment({
        idempotencyKey: 'idem-1',
        requestId: 'request-1',
        orderId: 'order-1',
        paymentId: 'local-payment-1',
        amount: 10000,
        customerId: 'customer-1',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
