import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega el valor 'payway' a los enums de metodo de pago. No destructiva:
 * solo agrega un valor al enum (IF NOT EXISTS) y no modifica datos.
 */
export class AddPaywayPaymentMethod1789100000000 implements MigrationInterface {
  name = 'AddPaywayPaymentMethod1789100000000';

  private readonly enumTypes = [
    'orders_paymentmethod_enum',
    'payments_method_enum',
    'user_payment_methods_method_enum',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const enumType of this.enumTypes) {
      // El bloque DO evita fallar si el enum todavia no existe en la base.
      await queryRunner.query(
        `DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumType}') THEN
            ALTER TYPE "${enumType}" ADD VALUE IF NOT EXISTS 'payway';
          END IF;
        END $$;`,
      );
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL no permite quitar un valor de un enum sin recrear el tipo.
    // Se deja como no-op para no tocar datos existentes.
  }
}
