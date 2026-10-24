import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getPool, query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = getPool();
  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureAdmin() {
  const existing = await query('SELECT id FROM users WHERE username = $1', [config.defaultAdminUser]);
  if (existing.rowCount) {
    console.log(`OK: admin listo (${config.defaultAdminUser})`);
    return;
  }
  const hash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await query('INSERT INTO users (username, password_hash, name) VALUES ($1, $2, $3)', [
    config.defaultAdminUser,
    hash,
    'Administrador',
  ]);
  console.log(`OK: admin creado (${config.defaultAdminUser})`);
}

async function ensureSettings() {
  await query('UPDATE store_settings SET timezone = $1 WHERE id = 1', [config.storeTimezone]);
  const current = await query('SELECT name FROM store_settings WHERE id = 1');
  if (current.rows[0]?.name === 'Mi comercio' && config.storeName) {
    await query('UPDATE store_settings SET name = $1 WHERE id = 1', [config.storeName]);
  }
}

async function seedDemo() {
  if (!config.seedDemo) return;
  const count = await query('SELECT COUNT(*)::int AS n FROM products');
  if (count.rows[0].n > 0) {
    console.log('OK: datos demo ya existen');
    return;
  }

  const categories = ['Kiosco y golosinas', 'Bebidas', 'Almacén', 'Librería', 'Limpieza', 'Perfumería', 'Bazar', 'Regalería'];
  const categoryIds = {};
  for (const name of categories) {
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
    categoryIds[name] = result.rows[0].id;
  }

  const products = [
    ['ALF-JORGITO', 'Alfajor Jorgito chocolate', 'Kiosco y golosinas', 'un', 550, 900, 60, 24],
    ['CHICLE-BELD', 'Chicles Beldent menta', 'Kiosco y golosinas', 'un', 600, 1000, 35, 15],
    ['CHOC-COFLER', 'Chocolate Cofler 55g', 'Kiosco y golosinas', 'un', 1300, 2100, 4, 10],
    ['CARAM-MASTI', 'Caramelos masticables x 800g', 'Kiosco y golosinas', 'un', 4200, 6500, 6, 3],
    ['COCA-2250', 'Coca Cola 2.25L', 'Bebidas', 'un', 2600, 3800, 30, 12],
    ['AGUA-VILLAV', 'Agua Villavicencio 1.5L', 'Bebidas', 'un', 1100, 1700, 24, 12],
    ['SPEED-250', 'Speed energizante 250ml', 'Bebidas', 'un', 1200, 2000, 18, 12],
    ['YERBA-PLAY', 'Yerba Playadito 1kg', 'Almacén', 'un', 4300, 5900, 25, 10],
    ['YERBA-ROSA', 'Yerba Rosamonte 500g', 'Almacén', 'un', 2300, 3200, 8, 10],
    ['AZUCAR-1KG', 'Azúcar Ledesma 1kg', 'Almacén', 'un', 1100, 1600, 30, 10],
    ['GALL-CHOCO', 'Galletitas Chocolinas 170g', 'Almacén', 'un', 1300, 1900, 20, 8],
    ['CUAD-RIVA', 'Cuaderno Rivadavia ABC 50 hojas', 'Librería', 'un', 2600, 3900, 15, 6],
    ['BIROME-BIC', 'Birome Bic azul', 'Librería', 'un', 380, 650, 80, 30],
    ['RESMA-A4', 'Resma A4 500 hojas', 'Librería', 'un', 6500, 9200, 5, 4],
    ['LAPIZ-FABER', 'Lápices de colores Faber x12', 'Librería', 'un', 3100, 4700, 12, 5],
    ['LAVAND-AYU', 'Lavandina Ayudín 1L', 'Limpieza', 'un', 900, 1400, 20, 8],
    ['DET-MAGIS', 'Detergente Magistral 500ml', 'Limpieza', 'un', 1900, 2800, 14, 6],
    ['ESPONJA-X3', 'Esponja multiuso x3', 'Limpieza', 'un', 800, 1300, 3, 6],
    ['SHAMPOO-SED', 'Shampoo Sedal 340ml', 'Perfumería', 'un', 2900, 4300, 10, 4],
    ['JABON-DOVE', 'Jabón Dove x90g', 'Perfumería', 'un', 1200, 1800, 22, 8],
    ['TERMO-1L', 'Termo acero 1L', 'Bazar', 'un', 14000, 21000, 6, 2],
    ['MATE-CAL', 'Mate de calabaza con bombilla', 'Bazar', 'un', 5200, 8500, 9, 3],
    ['TAZA-CERAM', 'Taza de cerámica decorada', 'Regalería', 'un', 2500, 4500, 14, 4],
    ['PELUCHE-M', 'Peluche mediano', 'Regalería', 'un', 6000, 10500, 7, 3],
  ];
  const productIds = {};
  const productInfo = {};
  for (const [sku, name, category, unit, cost, price, stock, min] of products) {
    const result = await query(
      `INSERT INTO products (sku, name, category_id, unit, cost_price, sale_price, stock_qty, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [sku, name, categoryIds[category], unit, cost, price, stock, min]
    );
    productIds[sku] = result.rows[0].id;
    productInfo[sku] = { name, cost, price };
    await query(
      `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, notes)
       VALUES ($1, 'import', $2, $3, 'Stock inicial demo')`,
      [result.rows[0].id, stock, cost]
    );
  }

  const customers = [
    ['Consumidor final', null, null, null],
    ['Escuela N° 123 (cooperadora)', '30-71555111-2', '3777-410001', 'cooperadora@escuela.test'],
    ['Rosa Benítez', '27-28111222-3', '3777-410002', null],
    ['Kiosco El Puerto', '20-30111444-8', '3777-410003', 'elpuerto@kiosco.test'],
  ];
  const customerIds = [];
  for (const [name, taxId, phone, email] of customers) {
    const result = await query(
      'INSERT INTO customers (name, tax_id, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, taxId, phone, email]
    );
    customerIds.push(result.rows[0].id);
  }

  const suppliers = [
    ['Distribuidora Litoral', '30-71666777-1', '3794-500100', 'ventas@litoral.test'],
    ['Librería Mayorista Goya', '30-71888222-4', '3777-500200', 'pedidos@mayoristagoya.test'],
    ['Golosinas del Paraná', '30-71999333-5', '3794-500300', 'golosinas@parana.test'],
  ];
  const supplierIds = [];
  for (const [name, taxId, phone, email] of suppliers) {
    const result = await query(
      'INSERT INTO suppliers (name, tax_id, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, taxId, phone, email]
    );
    supplierIds.push(result.rows[0].id);
  }

  async function demoSale(number, customerId, daysAgo, lines, paid, method, notes) {
    const total = lines.reduce((acc, [sku, qty]) => acc + qty * productInfo[sku].price, 0);
    const amount = paid === 'all' ? total : paid;
    const sale = await query(
      `INSERT INTO sales (number, customer_id, issued_at, status, subtotal, tax, total, paid, notes)
       VALUES ($1, $2, CURRENT_DATE - $3::int, 'confirmed', $4, 0, $4, $5, $6)
       RETURNING id`,
      [number, customerId, daysAgo, total, amount, notes]
    );
    const saleId = sale.rows[0].id;
    for (const [sku, qty] of lines) {
      const { name, cost, price } = productInfo[sku];
      await query(
        `INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, cost_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [saleId, productIds[sku], name, qty, price, cost, qty * price]
      );
      await query(
        `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id)
         VALUES ($1, 'sale', $2, $3, 'sale', $4)`,
        [productIds[sku], -qty, cost, saleId]
      );
      await query('UPDATE products SET stock_qty = stock_qty - $2 WHERE id = $1', [productIds[sku], qty]);
    }
    if (amount > 0) {
      await query(
        `INSERT INTO payments (kind, customer_id, sale_id, amount, method, notes)
         VALUES ('in', $1, $2, $3, $4, $5)`,
        [customerId, saleId, amount, method, amount < total ? 'Pago parcial' : null]
      );
    }
  }

  await demoSale('V-00001', customerIds[0], 2, [['YERBA-PLAY', 2], ['AZUCAR-1KG', 2], ['GALL-CHOCO', 3]], 'all', 'cash', null);
  await demoSale('V-00002', customerIds[1], 1, [['CUAD-RIVA', 6], ['BIROME-BIC', 12], ['LAPIZ-FABER', 3]], 20000, 'transfer', 'Útiles para la escuela, saldo a cuenta corriente');
  await demoSale('V-00003', customerIds[2], 1, [['MATE-CAL', 1], ['TERMO-1L', 1]], 'all', 'transfer', 'Regalo día de la madre');
  await demoSale('V-00004', customerIds[3], 0, [['ALF-JORGITO', 24], ['COCA-2250', 6], ['SPEED-250', 6]], 0, 'cash', 'Reventa, paga a fin de mes');
  await demoSale('V-00005', customerIds[0], 0, [['COCA-2250', 1], ['CHICLE-BELD', 2], ['LAVAND-AYU', 1]], 'all', 'cash', null);

  const purchaseLines = [['ALF-JORGITO', 48], ['CHOC-COFLER', 12]];
  const purchaseTotal = purchaseLines.reduce((acc, [sku, qty]) => acc + qty * productInfo[sku].cost, 0);
  const purchase = await query(
    `INSERT INTO purchases (number, supplier_id, issued_at, status, subtotal, tax, total, paid, notes)
     VALUES ('C-00001', $1, CURRENT_DATE - 3, 'confirmed', $2, 0, $2, $2, 'Reposición de golosinas')
     RETURNING id`,
    [supplierIds[2], purchaseTotal]
  );
  const purchaseId = purchase.rows[0].id;
  for (const [sku, qty] of purchaseLines) {
    const { name, cost } = productInfo[sku];
    await query(
      `INSERT INTO purchase_items (purchase_id, product_id, description, qty, unit_cost, line_total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [purchaseId, productIds[sku], name, qty, cost, qty * cost]
    );
    await query(
      `INSERT INTO stock_movements (product_id, kind, qty, unit_cost, ref_type, ref_id)
       VALUES ($1, 'purchase', $2, $3, 'purchase', $4)`,
      [productIds[sku], qty, cost, purchaseId]
    );
    await query('UPDATE products SET stock_qty = stock_qty + $2 WHERE id = $1', [productIds[sku], qty]);
  }
  await query(
    `INSERT INTO payments (kind, supplier_id, purchase_id, amount, method, notes)
     VALUES ('out', $1, $2, $3, 'transfer', 'Pago al proveedor')`,
    [supplierIds[2], purchaseId, purchaseTotal]
  );

  console.log('OK: datos demo cargados');
}

async function migrate() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runSchema();
  console.log('OK: schema aplicado');
  await ensureSettings();
  await ensureAdmin();
  await seedDemo();
  console.log('Migrations completed successfully.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch(async (err) => {
      console.error('Migration failed:', err.message);
      try {
        await getPool().end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

export { migrate };
