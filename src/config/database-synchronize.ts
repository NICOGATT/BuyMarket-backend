/**
 * Decide si TypeORM puede sincronizar el esquema automaticamente.
 *
 * Regla de seguridad:
 * - En produccion SIEMPRE false (el esquema se gestiona con migraciones).
 * - Fuera de produccion solo true si DB_SYNCHRONIZE se habilita explicitamente.
 * - Default: false.
 */
export interface DatabaseSynchronizeOptions {
  nodeEnv?: string;
  dbSynchronize?: string | boolean;
}

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on']);

export function resolveDatabaseSynchronize(
  options: DatabaseSynchronizeOptions,
): boolean {
  const nodeEnv = options.nodeEnv?.trim().toLowerCase();
  if (nodeEnv === 'production') {
    return false;
  }

  const raw = options.dbSynchronize;
  if (raw === true) {
    return true;
  }

  if (typeof raw === 'string') {
    return TRUTHY_VALUES.has(raw.trim().toLowerCase());
  }

  return false;
}
