import * as dotenv from 'dotenv';

import {
  BackfillColor,
  BackfillVariant,
  resolveVariantCatalogColor,
} from '../src/modules/colors/variant-color-backfill.util';

const { Client } = require('pg');

dotenv.config();

type VariantRow = BackfillVariant & { id: string };

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

  try {
    const colorsResult = (await client.query(`
      SELECT id, name, "normalizedName", hex
      FROM colors
      ORDER BY name ASC
    `)) as { rows: BackfillColor[] };
    const variantsResult = (await client.query(`
      SELECT id, color, "colorHex", "catalogColorId"
      FROM product_variants
      ORDER BY id ASC
    `)) as { rows: VariantRow[] };

    let updated = 0;
    let unresolved = 0;
    let alreadyLinked = 0;

    await client.query('BEGIN');

    for (const variant of variantsResult.rows) {
      if (variant.catalogColorId) {
        alreadyLinked += 1;
        continue;
      }

      const catalogColor = resolveVariantCatalogColor(
        variant,
        colorsResult.rows,
      );

      if (!catalogColor) {
        unresolved += 1;
        continue;
      }

      const result = await client.query(
        `
          UPDATE product_variants
          SET
            "catalogColorId" = $1,
            color = CASE
              WHEN color IS NULL OR BTRIM(color) = '' THEN $2
              ELSE color
            END
          WHERE id = $3 AND "catalogColorId" IS NULL
        `,
        [catalogColor.id, catalogColor.name, variant.id],
      );

      updated += result.rowCount ?? 0;
    }

    await client.query('COMMIT');
    console.log(
      `Variant color backfill complete. Updated: ${updated}. ` +
        `Already linked: ${alreadyLinked}. Unresolved: ${unresolved}.`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
