import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PaywayEnvironment = 'sandbox' | 'production';

const PAYWAY_ENDPOINTS: Record<
  PaywayEnvironment,
  { checkoutLinkApi: string; checkoutForm: string }
> = {
  sandbox: {
    checkoutLinkApi:
      'https://developers.decidir.com/api/v1/checkout-payment-button',
    checkoutForm: 'https://developers.decidir.com/web/checkout',
  },
  production: {
    checkoutLinkApi:
      'https://ventasonline.payway.com.ar/api/v1/checkout-payment-button',
    checkoutForm: 'https://live.decidir.com/web/checkout',
  },
};

/**
 * Datos de negocio para crear un link de pago (formulario de pago de Payway).
 * La clave publica, el site y los parametros fijos (template, 3DS, cuotas) se
 * completan dentro del cliente a partir de la configuracion.
 */
export interface PaywayPaymentLinkInput {
  description: string;
  /** Importe total en pesos (decimal), segun los ejemplos del SDK oficial. */
  totalPrice: number;
  successUrl: string;
  cancelUrl: string;
  notificationsUrl: string;
}

export interface PaywayPaymentLink {
  paymentId: string;
  checkoutUrl: string;
}

@Injectable()
export class PaywayClient {
  private readonly logger = new Logger(PaywayClient.name);
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configured = Number(
      this.configService.get<string>('PAYWAY_TIMEOUT_MS'),
    );
    this.timeoutMs =
      Number.isFinite(configured) && configured > 0 ? configured : 10_000;
  }

  isConfigured() {
    return ['PAYWAY_PUBLIC_KEY', 'PAYWAY_PRIVATE_KEY', 'PAYWAY_SITE_ID'].every(
      (key) => Boolean(this.configService.get<string>(key)?.trim()),
    );
  }

  /**
   * Crea el link del formulario de pago. Payway aloja el formulario, por lo que
   * los datos de tarjeta nunca pasan por este backend.
   */
  async createPaymentLink(
    input: PaywayPaymentLinkInput,
  ): Promise<PaywayPaymentLink> {
    const endpoints = this.getEndpoints();
    const response = await this.fetchWithTimeout(
      `${endpoints.checkoutLinkApi}/link`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: this.getRequiredConfig('PAYWAY_PRIVATE_KEY'),
          'X-Source': this.buildSourceHeader(),
        },
        body: JSON.stringify({
          origin_platform: 'SDK-Node',
          payment_description: input.description,
          currency: 'ARS',
          total_price: input.totalPrice,
          site: this.getRequiredConfig('PAYWAY_SITE_ID'),
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          notifications_url: input.notificationsUrl,
          template_id: this.getTemplateId(),
          installments: this.getInstallments(),
          plan_gobierno: false,
          public_apikey: this.getRequiredConfig('PAYWAY_PUBLIC_KEY'),
          auth_3ds: this.isFlagEnabled('PAYWAY_AUTH_3DS'),
        }),
      },
    );

    if (!response.ok) {
      const detail = await this.safeErrorDetail(response);
      this.logger.error(
        `Payway payment link request failed with status ${response.status}${detail ? ` detail=${detail}` : ''}`,
      );
      throw new BadGatewayException('Payway no pudo crear el link de pago');
    }

    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const paymentId = this.firstString(
      result?.id,
      result?.payment_id,
      result?.hash,
    );
    // Si Payway no devuelve la URL completa, se arma con el id del pago
    // (https://<host>/web/checkout/{payment_id}, segun el SDK oficial).
    const checkoutUrl =
      this.firstString(result?.url, result?.link, result?.checkout_url) ??
      (paymentId
        ? `${endpoints.checkoutForm}/${encodeURIComponent(paymentId)}`
        : undefined);

    if (!paymentId || !checkoutUrl) {
      this.logger.error('Payway returned a payment link without id or url');
      throw new BadGatewayException('Payway devolvio una respuesta invalida');
    }

    return { paymentId, checkoutUrl };
  }

  private getEnvironment(): PaywayEnvironment {
    const raw = this.configService
      .get<string>('PAYWAY_ENV')
      ?.trim()
      .toLowerCase();
    return raw === 'production' ? 'production' : 'sandbox';
  }

  private getEndpoints() {
    return PAYWAY_ENDPOINTS[this.getEnvironment()];
  }

  private getTemplateId() {
    // 1 = sin Cybersource, 2 = con Cybersource (segun el SDK oficial).
    return this.configService.get<string>('PAYWAY_TEMPLATE_ID')?.trim() === '2'
      ? 2
      : 1;
  }

  private getInstallments() {
    const raw = this.configService.get<string>('PAYWAY_INSTALLMENTS')?.trim();
    const parsed = (raw ?? '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    return parsed.length > 0 ? parsed : [1];
  }

  private isFlagEnabled(key: string) {
    const raw = this.configService.get<string>(key)?.trim().toLowerCase();
    return raw === 'true' || raw === '1';
  }

  private buildSourceHeader() {
    return Buffer.from(
      JSON.stringify({
        service: 'SDK-NODE',
        grouper: 'BuyMarket',
        developer: 'backend',
      }),
    ).toString('base64');
  }

  private async safeErrorDetail(response: Response) {
    try {
      const text = await response.text();
      // Se recorta y se limpian posibles claves/tokens que vengan en el body.
      return text
        .replace(
          /"(apikey|public_apikey|private_apikey|token)"\s*:\s*"[^"]*"/gi,
          '"$1":"[redacted]"',
        )
        .slice(0, 300);
    } catch {
      return '';
    }
  }

  private firstString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
    return undefined;
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        'La integracion con Payway todavia no esta configurada',
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
        throw new GatewayTimeoutException('Payway no respondio a tiempo');
      }

      this.logger.error(`Could not connect to Payway at ${url}`);
      throw new ServiceUnavailableException('No se pudo conectar con Payway');
    }
  }
}
