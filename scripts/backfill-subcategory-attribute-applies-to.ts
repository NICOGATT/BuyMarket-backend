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
    ALTER TYPE sub_category_attributes_usage_enum ADD VALUE IF NOT EXISTS 'variant_attribute';
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
          WHEN name = 'Talle' THEN 'variant_size'
          WHEN name = 'Color' THEN 'variant_color'
          WHEN name = ANY($2) THEN 'product_attribute'
          WHEN name = ANY($1) THEN 'variant_attribute'
          WHEN "appliesToVariant" IS TRUE THEN 'variant_attribute'
          WHEN usage = 'PRODUCT_ATTRIBUTE' THEN 'product_attribute'
          WHEN usage = 'VARIANT_ATTRIBUTE' THEN 'variant_attribute'
          WHEN usage = 'VARIANT_SIZE' THEN 'variant_size'
          WHEN usage = 'VARIANT_COLOR' THEN 'variant_color'
          ELSE COALESCE(usage, 'product_attribute')
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
