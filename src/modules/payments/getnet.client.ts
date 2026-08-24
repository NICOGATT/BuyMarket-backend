import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_GETNET_PAYMENT_INTENT_PATH =
  '/digital-checkout/v1/payment-intent';

/**
 * Cuerpo documentado por el manual vigente de Web Checkout Global
 * (creacion simplificada de pago). Las URLs de success/error/callback no se
 * envian por operacion: se configuran una vez en el portal de Getnet.
 */
export interface GetnetPaymentIntentRequest {
  order_id: string;
  customer: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  payment: {
    currency: 'ARS';
    amount: number;
  };
}

export interface GetnetPaymentIntentResponse {
  payment_intent_id: string;
  checkout_url?: string;
}

interface GetnetTokenCache {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class GetnetClient {
  private readonly logger = new Logger(GetnetClient.name);
  private readonly timeoutMs: number;
  private tokenCache: GetnetTokenCache | null = null;

  constructor(private readonly configService: ConfigService) {
    const configured = Number(this.configService.get<string>('GETNET_TIMEOUT_MS'));
    this.timeoutMs =
      Number.isFinite(configured) && configured > 0 ? configured : 10_000;
  }

  async createPaymentIntent(
    payload: GetnetPaymentIntentRequest,
  ): Promise<GetnetPaymentIntentResponse> {
    let response = await this.sendPaymentIntent(payload);

    if (response.status === 401) {
      this.tokenCache = null;
      response = await this.sendPaymentIntent(payload);
    }

    if (!response.ok) {
      const detail = await this.safeErrorDetail(response);
      this.logger.error(
        `Getnet payment intent request failed with status ${response.status}${detail ? ` detail=${detail}` : ''}`,
      );
      throw new BadGatewayException(
        'Getnet no pudo crear la intencion de pago',
      );
    }

    const result =
      (await response.json()) as Partial<GetnetPaymentIntentResponse>;

    if (!result.payment_intent_id) {
      this.logger.error('Getnet returned a payment intent without an id');
      throw new BadGatewayException('Getnet devolvio una respuesta invalida');
    }

    return {
      payment_intent_id: result.payment_intent_id,
      checkout_url: this.nonEmptyString(result.checkout_url),
    };
  }

  getLoaderUrl() {
    return `${this.getBaseUrl('GETNET_WEB_URL')}/digital-checkout/loader.js`;
  }

  getPaymentIntentPath() {
    const configured = this.configService
      .get<string>('GETNET_PAYMENT_INTENT_PATH')
      ?.trim();

    const path = configured || DEFAULT_GETNET_PAYMENT_INTENT_PATH;
    return path.startsWith('/') ? path : `/${path}`;
  }

  private async sendPaymentIntent(payload: GetnetPaymentIntentRequest) {
    const accessToken = await this.getAccessToken();

    return this.fetchWithTimeout(
      `${this.getApiUrl()}${this.getPaymentIntentPath()}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
  }

  private async getAccessToken() {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.getRequiredConfig('GETNET_CLIENT_ID'),
      client_secret: this.getRequiredConfig('GETNET_CLIENT_SECRET'),
    });
    const response = await this.fetchWithTimeout(
      `${this.getApiUrl()}/authentication/oauth2/access_token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
    );

    if (!response.ok) {
      this.logger.error(
        `Getnet authentication failed with status ${response.status}`,
      );
      throw new BadGatewayException('No se pudo autenticar con Getnet');
    }

    const token = (await response.json()) as {
      access_token?: string;
      expires_in?: number | string;
    };
    const expiresInSeconds = Number(token.expires_in);

    if (!token.access_token || !Number.isFinite(expiresInSeconds)) {
      this.logger.error('Getnet returned an invalid authentication response');
      throw new BadGatewayException('Getnet devolvio una respuesta invalida');
    }

    this.tokenCache = {
      accessToken: token.access_token,
      expiresAt: Date.now() + Math.max(0, expiresInSeconds * 1000 - 60_000),
    };

    return token.access_token;
  }

  private async safeErrorDetail(response: Response) {
    try {
      const text = await response.text();
      // Se recorta y se limpian posibles tokens que pudieran venir en el body.
      return text
        .replace(/"(access_token|client_secret|token)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
        .slice(0, 300);
    } catch {
      return '';
    }
  }

  private nonEmptyString(value?: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private getApiUrl() {
    return this.getBaseUrl('GETNET_API_URL');
  }

  private getBaseUrl(key: string) {
    return this.getRequiredConfig(key).replace(/\/$/, '');
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        'La integracion con Getnet todavia no esta configurada',
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
        throw new GatewayTimeoutException('Getnet no respondio a tiempo');
      }

      this.logger.error(`Could not connect to Getnet at ${url}`);
      throw new ServiceUnavailableException('No se pudo conectar con Getnet');
    }
  }
}
