import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega products.deletedAt para el borrado logico de productos que ya
 * tienen ordenes. Migracion no destructiva: solo agrega una columna nullable.
 */
export class AddProductDeletedAt1793318400000 implements MigrationInterface {
  name = 'AddProductDeletedAt1793318400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
