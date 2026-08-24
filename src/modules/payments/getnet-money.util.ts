import { ConfigService } from '@nestjs/config';

export type GetnetAmountUnit = 'cents' | 'pesos';

/**
 * Convierte un importe de la base de datos a la unidad que espera Getnet.
 *
 * La documentacion disponible no confirma con certeza si `amount` se expresa
 * en pesos o en centavos para Web Checkout, por lo que la unidad es
 * configurable mediante GETNET_AMOUNT_UNIT:
 * - `cents` (default): 1500 -> 150000
 * - `pesos`: 1500 -> 1500
 */
export function toGetnetAmount(
  configService: Pick<ConfigService, 'get'>,
  value: number | string,
): number {
  const unit = parseAmountUnit(configService);
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`Importe invalido para Getnet: ${String(value)}`);
  }

  return unit === 'cents'
    ? Math.round(numeric * 100)
    : Math.round(numeric * 100) / 100;
}

/**
 * Convierte un importe recibido desde Getnet (webhook) a pesos para compararlo
 * contra el total de la orden, segun la misma configuracion de unidad.
 */
export function getnetAmountToPesos(
  configService: Pick<ConfigService, 'get'>,
  value: number,
): number {
  const unit = parseAmountUnit(configService);
  return unit === 'cents'
    ? Math.round(value) / 100
    : Math.round(value * 100) / 100;
}

export function isGetnetAmountInteger(
  configService: Pick<ConfigService, 'get'>,
  value: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  const unit = parseAmountUnit(configService);
  // En centavos el valor siempre debe ser entero; en pesos se toleran hasta 2 decimales.
  const scaled = unit === 'cents' ? value : value * 100;
  return Number.isInteger(scaled);
}

function parseAmountUnit(configService: Pick<ConfigService, 'get'>) {
  const raw = configService.get<string>('GETNET_AMOUNT_UNIT')?.trim().toLowerCase();
  if (!raw || raw === 'cents' || raw === 'centavos') return 'cents';
  if (raw === 'pesos' || raw === 'ars') return 'pesos';
  return 'cents';
}
