// Suma productos y proveedores sin borrar nada: los productos que ya existen (mismo SKU o
// código de barras) y los proveedores con el mismo nombre se dejan como están. Corre una sola vez por ADD_TOKEN, registrado en
// maintenance_runs. Lee ADD_PRODUCTS_FILE (en scripts/data) con la clave ADD_PRODUCTS_KEY.
import { getPool, withTransaction } from '../server/db/pool.js';
import { readCatalog } from './catalog-file.js';

async function run() {
  const token = (process.env.ADD_TOKEN || '').trim();
  const file = (process.env.ADD_PRODUCTS_FILE || '').trim();
  if (!token || !file) {
    console.log('add-products: omitido (falta ADD_TOKEN o ADD_PRODUCTS_FILE)');
    return;
  }
  const catalog = readCatalog(file, (process.env.ADD_PRODUCTS_KEY || '').trim());
  // El archivo puede ser una lista de productos o { products, suppliers }.
  const rows = Array.isArray(catalog) ? catalog : catalog.products || [];
  const suppliers = Array.isArray(catalog) ? [] : catalog.suppliers || [];

  await withTransaction(async (client) => {
    await client.query(
      'CREATE TABLE IF NOT EXISTS maintenance_runs (name TEXT PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const done = await client.query('SELECT 1 FROM maintenance_runs WHERE name = $1', [token]);
    if (done.rowCount) {
      console.log(`add-products: ${token} ya se aplicó, no se repite`);
      return;
    }
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      const exists = await client.query(
        `SELECT 1 FROM products WHERE sku = $1 OR ($2::text IS NOT NULL AND barcode = $2)`,
        [row.sku, row.barcode || null]
      );
      if (exists.rowCount) {
        skipped += 1;
        continue;
      }
      let categoryId = null;
      if (row.category) {
        const found = await client.query('SELECT id FROM categories WHERE lower(name) = lower($1)', [row.category]);
        categoryId = found.rowCount
          ? found.rows[0].id
          : (await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [row.category])).rows[0].id;
      }
      await client.query(
        `INSERT INTO products (sku, name, description, category_id, unit, barcode, cost_price, sale_price, stock_qty, min_stock, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, true)`,
        [row.sku, row.name, row.description || null, categoryId, row.unit || 'un', row.barcode || null, row.cost_price, row.sale_price]
      );
      added += 1;
    }
    let suppliersAdded = 0;
    for (const s of suppliers) {
      const found = await client.query('SELECT 1 FROM suppliers WHERE lower(name) = lower($1)', [s.name]);
      if (found.rowCount) continue;
      await client.query(
        'INSERT INTO suppliers (name, tax_id, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [s.name, s.taxId || null, s.phone || null, s.email || null, s.address || null, s.notes || null]
      );
      suppliersAdded += 1;
    }
    await client.query('INSERT INTO maintenance_runs (name) VALUES ($1)', [token]);
    console.log(
      `add-products: ${token} aplicado · ${added} agregados · ${skipped} ya existían · ${suppliersAdded} proveedores nuevos`
    );
  });
}

run()
  .then(() => getPool().end())
  .catch(async (err) => {
    console.error('add-products: falló, no se cambió nada:', err.message);
    await getPool().end().catch(() => {});
    process.exit(1);
  });
