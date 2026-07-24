import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateGetnetQrPaymentRequest {
  idempotencyKey: string;
  requestId: string;
  orderId: string;
  paymentId: string;
  amount: number;
  customerId: string;
  customerEmail?: string;
}

export interface GetnetQrPayment {
  paymentId: string;
  orderId?: string;
  qrPayload?: string;
  expiresAt?: string;
  status?: string;
  amount?: number;
  currency?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

type JsonRecord = Record<string, unknown>;

@Injectable()
export class GetnetQrClient {
  private readonly logger = new Logger(GetnetQrClient.name);
  private readonly timeoutMs = 10_000;
  private tokenCache: TokenCache | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured() {
    return (
      this.configService.get<string>('GETNET_QR_ENABLED') === 'true' &&
      this.hasConfig('GETNET_QR_API_URL') &&
      this.hasConfig('GETNET_QR_CLIENT_ID') &&
      this.hasConfig('GETNET_QR_CLIENT_SECRET') &&
      this.hasConfig('GETNET_QR_SELLER_ID')
    );
  }

  async createPayment(
    request: CreateGetnetQrPaymentRequest,
  ): Promise<GetnetQrPayment> {
    const payload = {
      idempotency_key: request.idempotencyKey,
      request_id: request.requestId,
      order_id: request.orderId,
      data: {
        amount: request.amount,
        currency: 'ARS',
        customer_id: request.customerId,
        payment: {
          payment_id: request.paymentId,
          payment_method: 'QR',
        },
        additional_data: {
          callback_url: this.getRequiredConfig('GETNET_QR_WEBHOOK_URL'),
          customer: {
            email: request.customerEmail,
          },
        },
      },
    };

    const response = await this.authorizedFetch(
      '/dpm/payments-gwproxy/v2/payments/qrcode',
      { method: 'POST', body: JSON.stringify(payload) },
    );
    const body = await this.parseResponse(response, 'crear el QR');
    const payment = this.normalizePayment(body);

    if (!payment.paymentId || !payment.qrPayload) {
      this.logger.error('Getnet returned a QR response without id or payload');
      throw new BadGatewayException('Getnet devolvio un QR invalido');
    }

    return payment;
  }

  async getPayment(paymentId: string): Promise<GetnetQrPayment> {
    const response = await this.authorizedFetch(
      `/dpm/hub-payment-info/v1/payments/info/${encodeURIComponent(paymentId)}`,
      { method: 'GET' },
    );
    const body = await this.parseResponse(response, 'consultar el pago');
    return this.normalizePayment(body, paymentId);
  }

  private async authorizedFetch(path: string, init: RequestInit) {
    let accessToken = await this.getAccessToken();
    let response = await this.fetchWithTimeout(`${this.getApiUrl()}${path}`, {
      ...init,
      headers: this.apiHeaders(accessToken),
    });

    if (response.status === 401) {
      this.tokenCache = null;
      accessToken = await this.getAccessToken();
      response = await this.fetchWithTimeout(`${this.getApiUrl()}${path}`, {
        ...init,
        headers: this.apiHeaders(accessToken),
      });
    }

    return response;
  }

  private apiHeaders(accessToken: string) {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-seller-id': this.getRequiredConfig('GETNET_QR_SELLER_ID'),
      'x-transaction-channel-entry':
        this.configService.get<string>('GETNET_QR_CHANNEL')?.trim() ?? 'WEB',
      country: 'AR',
    };
  }

  private async getAccessToken() {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(
      `${this.getRequiredConfig('GETNET_QR_CLIENT_ID')}:${this.getRequiredConfig('GETNET_QR_CLIENT_SECRET')}`,
    ).toString('base64');
    const response = await this.fetchWithTimeout(
      `${this.getApiUrl()}/authentication/oauth2/access_token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );

    if (!response.ok) {
      throw new BadGatewayException('No se pudo autenticar con Getnet QR');
    }

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number | string;
    };
    const expiresIn = Number(body.expires_in);

    if (!body.access_token || !Number.isFinite(expiresIn)) {
      throw new BadGatewayException('Getnet devolvio un token QR invalido');
    }

    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - 60_000),
    };
    return body.access_token;
  }

  private async parseResponse(response: Response, operation: string) {
    if (!response.ok) {
      this.logger.error(`Getnet could not ${operation}: ${response.status}`);
      throw new BadGatewayException(`Getnet no pudo ${operation}`);
    }

    return (await response.json()) as JsonRecord;
  }

  private normalizePayment(body: JsonRecord, fallbackId?: string) {
    const data = this.asRecord(body.data);
    const payment = this.asRecord(data.payment ?? body.payment);
    const qr = this.asRecord(data.qr ?? body.qr);

    return {
      paymentId: this.stringValue(
        body.payment_id ?? data.payment_id ?? payment.payment_id ?? fallbackId,
      ),
      orderId: this.optionalString(body.order_id ?? data.order_id),
      qrPayload: this.optionalString(
        body.qr_code ??
          body.qr_payload ??
          data.qr_code ??
          data.qr_payload ??
          payment.qr_code ??
          qr.payload,
      ),
      expiresAt: this.optionalString(
        body.expiration_date ??
          body.expires_at ??
          data.expiration_date ??
          data.expires_at ??
          qr.expires_at,
      ),
      status: this.optionalString(body.status ?? data.status ?? payment.status),
      amount: this.optionalNumber(body.amount ?? data.amount ?? payment.amount),
      currency: this.optionalString(
        body.currency ?? data.currency ?? payment.currency,
      ),
    };
  }

  private asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null
      ? (value as JsonRecord)
      : {};
  }

  private stringValue(value: unknown) {
    return this.optionalString(value) ?? '';
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private optionalNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private getApiUrl() {
    return this.getRequiredConfig('GETNET_QR_API_URL').replace(/\/$/, '');
  }

  private hasConfig(key: string) {
    return Boolean(this.configService.get<string>(key)?.trim());
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        'La integracion QR de Getnet todavia no esta configurada',
      );
    }

    return value;
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Getnet QR no respondio a tiempo');
      }

      throw new ServiceUnavailableException(
        'No se pudo conectar con Getnet QR',
      );
    }
  }
}
