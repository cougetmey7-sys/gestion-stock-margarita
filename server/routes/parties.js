import { Router } from 'express';
import { query } from '../db/pool.js';
import { emptyToNull } from '../lib/helpers.js';

export function partyRouter(table) {
  const router = Router();
  const label = table === 'customers' ? 'Cliente' : 'Proveedor';
  const fk = table === 'customers' ? 'customer_id' : 'supplier_id';
  const docs = table === 'customers' ? 'sales' : 'purchases';
  const balanceSql =
    table === 'customers'
      ? `COALESCE((SELECT SUM(s.total - s.paid) FROM sales s WHERE s.customer_id = p.id AND s.status = 'confirmed'), 0)`
      : `COALESCE((SELECT SUM(s.total - s.paid) FROM purchases s WHERE s.supplier_id = p.id AND s.status = 'confirmed'), 0)`;

  router.get('/', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const params = [];
      let sql = `SELECT p.*, ${balanceSql} AS balance FROM ${table} p`;
      if (q) {
        params.push(`%${q}%`);
        sql += ` WHERE p.name ILIKE $1 OR COALESCE(p.tax_id, '') ILIKE $1 OR COALESCE(p.phone, '') ILIKE $1`;
      }
      sql += ' ORDER BY p.name';
      const result = await query(sql, params);
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT p.*, ${balanceSql} AS balance FROM ${table} p WHERE p.id = $1`,
        [req.params.id]
      );
      if (!result.rowCount) return res.status(404).json({ error: `${label} no encontrado` });
      const documents = await query(
        `SELECT id, number, issued_at, status, total, paid
         FROM ${docs}
         WHERE ${fk} = $1
         ORDER BY issued_at DESC, id DESC
         LIMIT 80`,
        [req.params.id]
      );
      const payments = await query(
        `SELECT * FROM payments WHERE ${fk} = $1 ORDER BY paid_at DESC, id DESC LIMIT 80`,
        [req.params.id]
      );
      res.json({ data: { ...result.rows[0], documents: documents.rows, payments: payments.rows } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const row = await saveParty(table, label, null, req.body);
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const row = await saveParty(table, label, req.params.id, req.body);
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function saveParty(table, label, id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('El nombre es obligatorio');
    err.status = 400;
    throw err;
  }
  const values = [
    name,
    emptyToNull(body.taxId),
    emptyToNull(body.phone),
    emptyToNull(body.email),
    emptyToNull(body.address),
    emptyToNull(body.notes),
  ];
  if (id) {
    const result = await query(
      `UPDATE ${table}
       SET name = $1, tax_id = $2, phone = $3, email = $4, address = $5, notes = $6
       WHERE id = $7
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) {
      const err = new Error(`${label} no encontrado`);
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const result = await query(
    `INSERT INTO ${table} (name, tax_id, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    values
  );
  return result.rows[0];
}
