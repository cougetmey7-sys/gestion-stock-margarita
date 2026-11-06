// Puesta en marcha de un comercio: borra los datos de ejemplo y carga el catálogo real.
// Corre una sola vez por RESET_TOKEN (queda registrado en maintenance_runs) y solo si
// RESET_CONFIRM=borrar-datos. El catálogo es una lista JSON de productos
// ({ sku, name, category, unit, cost_price, sale_price, description, ... }) comprimida con
// gzip y cifrada con AES-256-GCM en scripts/data/catalogo-inicial.enc; la clave va en
// INITIAL_PRODUCTS_KEY, así los costos del comercio no quedan legibles en el repositorio.
import { config } from '../server/config.js';
import { getPool, withTransaction } from '../server/db/pool.js';
import { hashKey } from '../server/lib/license.js';
import { readCatalog } from './catalog-file.js';

const TABLES = [
  'fixed_expense_payments',
  'fixed_expenses',
  'price_adjustment_items',
  'price_adjustments',
  'attachments',
  'payments',
  'stock_movements',
  'sale_items',
  'sales',
  'purchase_items',
  'purchases',
  'products',
  'categories',
  'customers',
  'suppliers',
];

function parseSuppliers(raw) {
  if (!raw) return [];
  return JSON.parse(raw);
}

async function run() {
  const token = (process.env.RESET_TOKEN || '').trim();
  if (process.env.RESET_CONFIRM !== 'borrar-datos' || !token) {
    console.log('reset: omitido (falta RESET_CONFIRM o RESET_TOKEN)');
    return;
  }
  const rows = readCatalog('catalogo-inicial.enc', (process.env.INITIAL_PRODUCTS_KEY || '').trim());

  await withTransaction(async (client) => {
    await client.query(
      'CREATE TABLE IF NOT EXISTS maintenance_runs (name TEXT PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const done = await client.query('SELECT 1 FROM maintenance_runs WHERE name = $1', [token]);
    if (done.rowCount) {
      console.log(`reset: ${token} ya se aplicó, no se repite`);
      return;
    }

    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('DELETE FROM sessions');

    const categoryIds = new Map();
    for (const row of rows) {
      const name = String(row.category || '').trim();
      if (!name || categoryIds.has(name)) continue;
      const res = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
      categoryIds.set(name, res.rows[0].id);
    }
    for (const row of rows) {
      await client.query(
        `INSERT INTO products (sku, name, description, category_id, unit, barcode, cost_price, sale_price, stock_qty, min_stock, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
        [
          String(row.sku).trim(),
          String(row.name).trim(),
          row.description || null,
          categoryIds.get(String(row.category || '').trim()) || null,
          row.unit || 'un',
          row.barcode || null,
          Number(row.cost_price) || 0,
          Number(row.sale_price) || 0,
          Number(row.stock_qty) || 0,
          Number(row.min_stock) || 0,
        ]
      );
    }

    for (const s of parseSuppliers(process.env.INITIAL_SUPPLIERS_JSON)) {
      await client.query(
        'INSERT INTO suppliers (name, tax_id, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [s.name, s.taxId || null, s.phone || null, s.email || null, s.address || null, s.notes || null]
      );
    }

    if (config.licenseKey) {
      await client.query('UPDATE store_settings SET license_key_hash = $1 WHERE id = 1', [hashKey(config.licenseKey)]);
    }
    await client.query('INSERT INTO maintenance_runs (name) VALUES ($1)', [token]);
    console.log(`reset: ${token} aplicado · ${rows.length} productos · ${categoryIds.size} categorías`);
  });
}

run()
  .then(() => getPool().end())
  .catch(async (err) => {
    console.error('reset: falló, no se cambió nada:', err.message);
    await getPool().end().catch(() => {});
    process.exit(1);
  });
