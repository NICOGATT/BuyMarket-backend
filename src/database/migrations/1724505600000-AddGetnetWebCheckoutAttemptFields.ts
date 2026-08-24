import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega los campos de auditoria e idempotencia de Getnet Web Checkout a
 * payment_attempts. Migracion no destructiva: solo agrega columnas e indices
 * con IF NOT EXISTS, no borra ni modifica datos existentes.
 */
export class AddGetnetWebCheckoutAttemptFields1724505600000
  implements MigrationInterface
{
  name = 'AddGetnetWebCheckoutAttemptFields1724505600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "providerPaymentId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "rawStatus" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "checkoutUrl" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN IF NOT EXISTS "metadata" jsonb`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_attempts_provider_payment_id" ON "payment_attempts" ("providerPaymentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down solo revierte la estructura agregada por up; nunca elimina datos.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_attempts_provider_payment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "lastNotifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "checkoutUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "rawStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN IF EXISTS "providerPaymentId"`,
    );
  }
}
