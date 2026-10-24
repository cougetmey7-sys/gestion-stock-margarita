import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money, qty } from '../lib/helpers.js';
import { applyStock } from '../lib/stock.js';
import { listAttachments, pullAttachments } from '../lib/attachments.js';
import { removeStoredFile } from '../lib/storage.js';

const router = Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name,
         (SELECT a.id FROM attachments a
          WHERE a.entity_type = 'product' AND a.entity_id = p.id AND a.kind = 'photo'
          ORDER BY a.id LIMIT 1) AS photo_id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const categoryId = req.query.categoryId;
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR COALESCE(p.barcode, '') ILIKE $${params.length})`
      );
    }
    if (categoryId) {
      params.push(Number(categoryId));
      where.push(`p.category_id = $${params.length}`);
    }
    if (req.query.active !== 'all') {
      where.push('p.active = true');
    }
    const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.name`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    const movements = await query(
      `SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 80`,
      [req.params.id]
    );
    const attachments = await listAttachments('product', req.params.id);
    res.json({ data: { ...result.rows[0], movements: movements.rows, attachments } });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const product = await createOrUpdateProduct(null, req.body);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const product = await createOrUpdateProduct(req.params.id, req.body);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const keys = await withTransaction(async (client) => {
      const product = await client.query('SELECT id, name FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!product.rowCount) throw httpError(404, 'Producto no encontrado');
      const used = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM sale_items WHERE product_id = $1) +
           (SELECT COUNT(*) FROM purchase_items WHERE product_id = $1) AS n`,
        [req.params.id]
      );
      if (Number(used.rows[0].n) > 0) {
        throw httpError(409, 'Este producto está en ventas o compras. Borrá esos comprobantes primero.');
      }
      const files = await pullAttachments(client, 'product', req.params.id);
      await client.query('DELETE FROM stock_movements WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM price_adjustment_items WHERE product_id = $1', [req.params.id]);
      await client.query('DELETE FROM products WHERE id = $1', [req.params.id]);
      return files;
    });
    await Promise.all(keys.map((key) => removeStoredFile(key)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/adjust-stock', async (req, res, next) => {
  try {
    const amount = Math.abs(qty(req.body?.qty ?? req.body?.delta));
    if (!amount) return res.status(400).json({ error: 'Indicá una cantidad distinta de cero' });
    const down =
      req.body?.direction === 'down' ||
      req.body?.direction === 'bajar' ||
      Number(req.body?.delta) < 0;
    const delta = down ? -amount : amount;
    const product = await withTransaction(async (client) => {
      await applyStock(client, {
        productId: Number(req.params.id),
        kind: 'manual',
        delta,
        notes: emptyToNull(req.body?.notes),
      });
      const result = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
      return result.rows[0];
    });
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

async function createOrUpdateProduct(id, body = {}) {
  const sku = String(body.sku || '').trim();
  const name = String(body.name || '').trim();
  if (!sku || !name) throw httpError(400, 'SKU y nombre son obligatorios');
  const values = [
    sku,
    name,
    emptyToNull(body.description),
    body.categoryId || null,
    String(body.unit || 'un').trim() || 'un',
    emptyToNull(body.barcode),
    money(body.costPrice),
    money(body.salePrice),
    qty(body.minStock),
    body.active !== false,
  ];
  if (id) {
    const result = await query(
      `UPDATE products
       SET sku = $1, name = $2, description = $3, category_id = $4, unit = $5, barcode = $6,
           cost_price = $7, sale_price = $8, min_stock = $9, active = $10, updated_at = now()
       WHERE id = $11
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Producto no encontrado');
    return result.rows[0];
  }
  const stockQty = qty(body.stockQty);
  const result = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO products
         (sku, name, description, category_id, unit, barcode, cost_price, sale_price, stock_qty, min_stock, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)
       RETURNING *`,
      values
    );
    const product = inserted.rows[0];
    if (stockQty) {
      await applyStock(client, {
        productId: product.id,
        kind: 'import',
        delta: stockQty,
        unitCost: money(body.costPrice),
        notes: 'Stock inicial',
      });
      product.stock_qty = stockQty;
    }
    return product;
  });
  return result;
}

export default router;
