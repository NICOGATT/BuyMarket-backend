import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega los campos de reset de contraseña a users. Migracion no
 * destructiva: solo agrega columnas con IF NOT EXISTS, no borra ni
 * modifica datos existentes.
 */
export class AddPasswordResetFields1789032831217
  implements MigrationInterface
{
  name = 'AddPasswordResetFields1789032831217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "resetPasswordExpires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "resetPasswordToken"`,
    );
  }
}
