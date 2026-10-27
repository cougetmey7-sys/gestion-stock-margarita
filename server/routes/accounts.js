import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { emptyToNull, httpError, money } from '../lib/helpers.js';
import { refreshPurchasePaid, refreshSalePaid } from '../lib/stock.js';

// Cuenta corriente: el debe son los comprobantes confirmados y el haber, los pagos imputados a ellos.
const KINDS = {
  customers: {
    party: 'customers',
    docs: 'sales',
    fk: 'customer_id',
    docFk: 'sale_id',
    paymentKind: 'in',
    receiptPrefix: 'R',
    docLabel: 'Venta',
    receiptLabel: 'Recibo',
    refresh: refreshSalePaid,
    label: 'Cliente',
  },
  suppliers: {
    party: 'suppliers',
    docs: 'purchases',
    fk: 'supplier_id',
    docFk: 'purchase_id',
    paymentKind: 'out',
    receiptPrefix: 'OP',
    docLabel: 'Compra',
    receiptLabel: 'Orden de pago',
    refresh: refreshPurchasePaid,
    label: 'Proveedor',
  },
};

export function accountRouter(kind) {
  const k = KINDS[kind];
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const params = [];
      const where = [];
      const q = String(req.query.q || '').trim();
      if (q) {
        params.push(`%${q}%`);
        where.push(`(p.name ILIKE $1 OR COALESCE(p.tax_id, '') ILIKE $1 OR COALESCE(p.phone, '') ILIKE $1)`);
      }
      const result = await query(
        `
        WITH docs AS (
          SELECT ${k.fk} AS party_id,
                 SUM(total) AS debit,
                 SUM(paid) AS credit,
                 COUNT(*) FILTER (WHERE total - paid > 0.004) AS pending_docs,
                 MIN(issued_at) FILTER (WHERE total - paid > 0.004) AS oldest_pending
          FROM ${k.docs}
          WHERE status = 'confirmed' AND ${k.fk} IS NOT NULL
          GROUP BY ${k.fk}
        ),
        pays AS (
          SELECT ${k.fk} AS party_id, MAX(paid_at) AS last_payment
          FROM payments
          WHERE kind = '${k.paymentKind}' AND ${k.fk} IS NOT NULL
          GROUP BY ${k.fk}
        )
        SELECT p.id, p.name, p.phone, p.tax_id,
               COALESCE(d.debit, 0) AS debit,
               COALESCE(d.credit, 0) AS credit,
               COALESCE(d.debit, 0) - COALESCE(d.credit, 0) AS balance,
               COALESCE(d.pending_docs, 0)::int AS pending_docs,
               to_char(d.oldest_pending, 'YYYY-MM-DD') AS oldest_pending,
               (CURRENT_DATE - d.oldest_pending)::int AS oldest_days,
               to_char(pa.last_payment, 'YYYY-MM-DD') AS last_payment
        FROM ${k.party} p
        LEFT JOIN docs d ON d.party_id = p.id
        LEFT JOIN pays pa ON pa.party_id = p.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY balance DESC, p.name
        `,
        params
      );
      const rows = result.rows.map((row) => ({
        ...row,
        debit: Number(row.debit),
        credit: Number(row.credit),
        balance: money(row.balance),
      }));
      const withBalance = rows.filter((row) => row.balance > 0.004);
      const totals = {
        balance: money(withBalance.reduce((acc, row) => acc + row.balance, 0)),
        accounts: withBalance.length,
        overdue30: money(withBalance.filter((row) => row.oldest_days > 30).reduce((acc, row) => acc + row.balance, 0)),
        oldestDays: withBalance.reduce((acc, row) => Math.max(acc, row.oldest_days || 0), 0),
      };
      res.json({ data: rows, totals });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const party = await query(`SELECT * FROM ${k.party} WHERE id = $1`, [req.params.id]);
      if (!party.rowCount) return res.status(404).json({ error: `${k.label} no encontrado` });
      res.json({ data: { party: party.rows[0], ...(await statement(k, req.params.id, req.query)) } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/payments', async (req, res, next) => {
    try {
      const receipt = await withTransaction((client) => payOnAccount(client, k, req.params.id, req.body, req.user?.id));
      res.status(201).json({ data: { receipt, ...(await statement(k, req.params.id, {})) } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function statement(k, partyId, { from, to } = {}) {
  const movements = await query(
    `
    SELECT * FROM (
      SELECT 'doc' AS type, d.id AS ref_id, d.number AS ref, to_char(d.issued_at, 'YYYY-MM-DD') AS date,
             d.created_at AS created_at, d.total AS debit, 0 AS credit, NULL AS method, d.notes AS notes,
             NULL AS docs
      FROM ${k.docs} d
      WHERE d.${k.fk} = $1 AND d.status = 'confirmed'
      UNION ALL
      SELECT 'payment' AS type, MIN(pa.id) AS ref_id, COALESCE(pa.receipt_number, '#' || MIN(pa.id)) AS ref,
             to_char(pa.paid_at, 'YYYY-MM-DD') AS date, MIN(pa.created_at) AS created_at, 0 AS debit,
             SUM(pa.amount) AS credit, MIN(pa.method) AS method, MIN(pa.notes) AS notes,
             string_agg(d.number, ', ' ORDER BY d.issued_at, d.id) AS docs
      FROM payments pa
      JOIN ${k.docs} d ON d.id = pa.${k.docFk} AND d.status = 'confirmed'
      WHERE d.${k.fk} = $1
      GROUP BY pa.paid_at, COALESCE(pa.receipt_number, '#' || pa.id), pa.receipt_number
    ) m
    ORDER BY m.date, m.created_at, m.type
    `,
    [partyId]
  );

  let running = 0;
  let opening = 0;
  const rows = [];
  for (const row of movements.rows) {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    running = money(running + debit - credit);
    if (from && row.date < from) {
      opening = running;
      continue;
    }
    if (to && row.date > to) continue;
    rows.push({ ...row, debit, credit, balance: running });
  }

  const pending = await query(
    `SELECT id, number, to_char(issued_at, 'YYYY-MM-DD') AS date, total, paid, total - paid AS remaining,
            (CURRENT_DATE - issued_at)::int AS days
     FROM ${k.docs}
     WHERE ${k.fk} = $1 AND status = 'confirmed' AND total - paid > 0.004
     ORDER BY issued_at, id`,
    [partyId]
  );

  return {
    opening,
    movements: rows,
    balance: running,
    pending: pending.rows.map((row) => ({
      ...row,
      total: Number(row.total),
      paid: Number(row.paid),
      remaining: money(row.remaining),
    })),
  };
}

async function payOnAccount(client, k, partyId, body = {}, userId) {
  const amount = money(body.amount);
  if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
  const party = await client.query(`SELECT id FROM ${k.party} WHERE id = $1`, [partyId]);
  if (!party.rowCount) throw httpError(404, `${k.label} no encontrado`);

  const docs = await client.query(
    `SELECT id, total - paid AS remaining
     FROM ${k.docs}
     WHERE ${k.fk} = $1 AND status = 'confirmed' AND total - paid > 0.004
     ORDER BY issued_at, id
     FOR UPDATE`,
    [partyId]
  );
  const owed = money(docs.rows.reduce((acc, row) => acc + Number(row.remaining), 0));
  if (owed <= 0) throw httpError(400, 'La cuenta no tiene saldo pendiente');
  if (amount > owed + 0.004) {
    throw httpError(400, `El importe supera el saldo de la cuenta (${owed.toLocaleString('es-AR')})`);
  }

  // Un número de comprobante por operación, aunque se reparta en varios comprobantes.
  await client.query('LOCK TABLE payments IN SHARE ROW EXCLUSIVE MODE');
  const last = await client.query(
    `SELECT receipt_number FROM payments WHERE receipt_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${k.receiptPrefix}-%`]
  );
  const n = last.rows[0] ? Number(last.rows[0].receipt_number.split('-').pop()) + 1 : 1;
  const receiptNumber = `${k.receiptPrefix}-${String(n).padStart(5, '0')}`;

  const method = body.method || 'cash';
  const paidAt = body.paidAt || new Date().toISOString().slice(0, 10);
  const notes = emptyToNull(body.notes);
  let left = amount;
  const applied = [];
  for (const doc of docs.rows) {
    if (left <= 0) break;
    const part = money(Math.min(left, Number(doc.remaining)));
    await client.query(
      `INSERT INTO payments (kind, ${k.fk}, ${k.docFk}, amount, method, paid_at, notes, created_by, receipt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [k.paymentKind, partyId, doc.id, part, method, paidAt, notes, userId || null, receiptNumber]
    );
    await k.refresh(client, doc.id);
    applied.push({ docId: doc.id, amount: part });
    left = money(left - part);
  }
  return { number: receiptNumber, amount, applied, label: k.receiptLabel };
}
