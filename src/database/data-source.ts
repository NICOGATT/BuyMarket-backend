import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * DataSource exclusivo para la CLI de migraciones (npm run migration:*).
 * La aplicacion sigue usando TypeOrmModule.forRootAsync en app.module.ts.
 *
 * synchronize siempre false aqui: los cambios de esquema entran unicamente
 * por migraciones versionadas.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'buymarket',
  entities: ['dist/src/modules/**/*.entity.js'],
  migrations: ['dist/src/database/migrations/*.js'],
  synchronize: false,
  logging: true,
});
