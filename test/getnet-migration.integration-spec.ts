import { DataSource } from 'typeorm';

import { AddGetnetWebCheckoutAttemptFields1724505600000 } from '../src/database/migrations/1724505600000-AddGetnetWebCheckoutAttemptFields';

/**
 * Verifica la migracion AddGetnetWebCheckoutAttemptFields contra PostgreSQL
 * real: parte de un esquema PREVIO (sin las columnas nuevas), ejecuta up,
 * comprueba columnas e indices, ejecuta down y comprueba que solo revierte lo
 * agregado. No depende de synchronize ni de datos previos.
 */
describe('Migracion Getnet con PostgreSQL', () => {
  const database = process.env.GETNET_TEST_DB_NAME ?? 'buymarket_webhook_test';
  const databaseHost = process.env.GETNET_TEST_DB_HOST ?? '127.0.0.1';

  let dataSource: DataSource;

  beforeAll(async () => {
    if (!database.endsWith('_test')) {
      throw new Error(
        `Base rechazada: ${database}. GETNET_TEST_DB_NAME debe terminar en _test.`,
      );
    }
    if (!['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
      throw new Error(
        `Host rechazado: ${databaseHost}. La prueba destructiva solo admite PostgreSQL local.`,
      );
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: databaseHost,
      port: Number(process.env.GETNET_TEST_DB_PORT ?? 55432),
      username: process.env.GETNET_TEST_DB_USER ?? 'postgres',
      password: process.env.GETNET_TEST_DB_PASSWORD ?? 'postgres',
      database,
      migrations: [AddGetnetWebCheckoutAttemptFields1724505600000],
      // Solo migraciones y SQL crudo: sin entidades ni synchronize.
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    // Esquema previo simulado: payment_attempts SIN las columnas nuevas.
    await dataSource.query(`DROP TABLE IF EXISTS "payment_attempts" CASCADE`);
    await dataSource.query(`DROP TABLE IF EXISTS "payments" CASCADE`);
    await dataSource.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "amount" numeric(12,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await dataSource.query(`
      CREATE TABLE "payment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idempotencyKey" varchar NOT NULL,
        "externalPaymentId" varchar,
        "status" varchar NOT NULL,
        "qrPayload" text,
        "expiresAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "paymentId" uuid NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE
      )
    `);
    await dataSource.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_attempts_idempotency_key" ON "payment_attempts" ("idempotencyKey")`,
    );
  });

  async function columnNames(table: string): Promise<string[]> {
    const result = await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table],
    );
    return result.map((row: { column_name: string }) => row.column_name);
  }

  async function indexNames(table: string): Promise<string[]> {
    const result = await dataSource.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = $1`,
      [table],
    );
    return result.map((row: { indexname: string }) => row.indexname);
  }

  it('up agrega columnas e indice y down revierte unicamente lo agregado', async () => {
    const columnsBefore = await columnNames('payment_attempts');
    expect(columnsBefore).not.toContain('providerPaymentId');
    expect(columnsBefore).not.toContain('rawStatus');
    expect(columnsBefore).not.toContain('checkoutUrl');
    expect(columnsBefore).not.toContain('lastNotifiedAt');
    expect(columnsBefore).not.toContain('metadata');

    // up (idempotente: correr dos veces no rompe)
    await dataSource.runMigrations({ transaction: 'each' });
    await dataSource.runMigrations({ transaction: 'each' });

    const columnsAfterUp = await columnNames('payment_attempts');
    for (const column of [
      'providerPaymentId',
      'rawStatus',
      'checkoutUrl',
      'lastNotifiedAt',
      'metadata',
    ]) {
      expect(columnsAfterUp).toContain(column);
    }
    expect(await indexNames('payment_attempts')).toContain(
      'IDX_payment_attempts_provider_payment_id',
    );

    // La estructura previa sobrevive intacta al up.
    expect(columnsAfterUp).toContain('idempotencyKey');
    expect(columnsAfterUp).toContain('externalPaymentId');

    // down revierte exactamente lo agregado y nada mas.
    await dataSource.undoLastMigration();

    const columnsAfterDown = await columnNames('payment_attempts');
    for (const column of [
      'providerPaymentId',
      'rawStatus',
      'checkoutUrl',
      'lastNotifiedAt',
      'metadata',
    ]) {
      expect(columnsAfterDown).not.toContain(column);
    }
    expect(await indexNames('payment_attempts')).not.toContain(
      'IDX_payment_attempts_provider_payment_id',
    );
    expect(columnsAfterDown).toEqual(expect.arrayContaining(columnsBefore));
    // La tabla ajena (payments) nunca fue tocada.
    expect(await columnNames('payments')).toContain('amount');
  });
});
