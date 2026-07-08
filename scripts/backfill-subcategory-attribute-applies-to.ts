import * as dotenv from 'dotenv';

const { Client } = require('pg');

dotenv.config();

const variantAttributeNames = [
  'Talle',
  'Color',
  'Largo de lomo',
  'Contorno de pecho',
  'Contorno de cuello',
];

const productAttributeNames = [
  'Marca',
  'Material',
  'Temporada',
  'Tipo de prenda',
  'Especie',
];

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

async function run() {
  await client.connect();

  await client.query(`
    ALTER TYPE sub_category_attributes_usage_enum ADD VALUE IF NOT EXISTS 'PRODUCT_ATTRIBUTE';
    ALTER TYPE sub_category_attributes_usage_enum ADD VALUE IF NOT EXISTS 'VARIANT_ATTRIBUTE';
    ALTER TYPE sub_category_attributes_usage_enum ADD VALUE IF NOT EXISTS 'VARIANT_SIZE';
    ALTER TYPE sub_category_attributes_usage_enum ADD VALUE IF NOT EXISTS 'VARIANT_COLOR';
  `);

  const result = await client.query(
    `
      UPDATE sub_category_attributes
      SET
        "appliesTo" = CASE
          WHEN name = ANY($1) THEN 'VARIANT'
          WHEN name = ANY($2) THEN 'PRODUCT'
          WHEN "appliesToVariant" IS TRUE THEN 'VARIANT'
          ELSE COALESCE("appliesTo", 'PRODUCT')
        END,
        "appliesToVariant" = CASE
          WHEN name = ANY($1) THEN TRUE
          WHEN name = ANY($2) THEN FALSE
          WHEN "appliesToVariant" IS TRUE THEN TRUE
          ELSE FALSE
        END,
        usage = CASE
          WHEN name = 'Talle' THEN 'VARIANT_SIZE'
          WHEN name = 'Color' THEN 'VARIANT_COLOR'
          WHEN name = ANY($2) THEN 'PRODUCT_ATTRIBUTE'
          WHEN name = ANY($1) THEN 'VARIANT_ATTRIBUTE'
          WHEN "appliesToVariant" IS TRUE THEN 'VARIANT_ATTRIBUTE'
          WHEN usage = 'variant_size' THEN 'VARIANT_SIZE'
          WHEN usage = 'variant_color' THEN 'VARIANT_COLOR'
          WHEN usage = 'product_attribute' THEN 'PRODUCT_ATTRIBUTE'
          ELSE COALESCE(usage, 'PRODUCT_ATTRIBUTE')
        END
      WHERE
        "appliesTo" IS NULL
        OR name = ANY($1)
        OR name = ANY($2)
        OR "appliesToVariant" IS TRUE
    `,
    [variantAttributeNames, productAttributeNames],
  );

  console.log(
    `Backfill complete. Updated ${result.rowCount} subcategory attributes.`,
  );

  await client.end();
}

run().catch(async error => {
  console.error(error);
  await client.end().catch(() => undefined);
  process.exit(1);
});
