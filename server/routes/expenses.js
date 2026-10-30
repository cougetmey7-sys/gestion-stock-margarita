import { Router } from 'express';
import { query } from '../db/pool.js';
import { emptyToNull, httpError, money } from '../lib/helpers.js';
import { FREQUENCY_MONTHS, nextDue, occursIn, schedule, storeToday } from '../lib/expenses.js';

const router = Router();
const METHODS = ['cash', 'transfer', 'card', 'check', 'other'];

router.get('/', async (_req, res, next) => {
  try {
    const today = storeToday();
    const result = await query(
      `SELECT e.id, e.name, e.category, e.payee, e.amount, e.frequency, e.due_day, e.notes, e.active,
              to_char(e.start_month, 'YYYY-MM-DD') AS start_month,
              (SELECT to_char(MAX(p.paid_at), 'YYYY-MM-DD') FROM fixed_expense_payments p WHERE p.expense_id = e.id) AS last_paid,
              (SELECT COALESCE(array_agg(to_char(p.period, 'YYYY-MM')), '{}') FROM fixed_expense_payments p WHERE p.expense_id = e.id) AS paid_periods
       FROM fixed_expenses e
       ORDER BY e.active DESC, e.name`
    );
    const rows = result.rows.map(({ paid_periods: paidPeriods, ...row }) => {
      const next = row.active ? nextDue(row, today.slice(0, 7), new Set(paidPeriods)) : null;
      return { ...row, amount: Number(row.amount), next_due: next, overdue: Boolean(next && next < today) };
    });
    const monthly = rows
      .filter((row) => row.active)
      .reduce((acc, row) => acc + row.amount / FREQUENCY_MONTHS[row.frequency], 0);
    res.json({ data: rows, totals: { monthlyAverage: money(monthly) } });
  } catch (err) {
    next(err);
  }
});

router.get('/schedule', async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : storeToday().slice(0, 7);
    res.json({ data: await schedule(month) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ data: await saveExpense(null, req.body) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json({ data: await saveExpense(req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM fixed_expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payments', async (req, res, next) => {
  try {
    const found = await query(
      `SELECT id, frequency, due_day, to_char(start_month, 'YYYY-MM-DD') AS start_month FROM fixed_expenses WHERE id = $1`,
      [req.params.id]
    );
    if (!found.rowCount) throw httpError(404, 'Gasto no encontrado');
    const period = String(req.body?.period || '');
    if (!/^\d{4}-\d{2}$/.test(period)) throw httpError(400, 'Período inválido');
    if (!occursIn(found.rows[0], period)) throw httpError(400, 'Ese gasto no vence en ese mes');
    const amount = money(req.body?.amount);
    if (amount <= 0) throw httpError(400, 'El importe debe ser mayor a cero');
    const method = METHODS.includes(req.body?.method) ? req.body.method : 'cash';
    const inserted = await query(
      `INSERT INTO fixed_expense_payments (expense_id, period, amount, paid_at, method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (expense_id, period) DO NOTHING
       RETURNING *`,
      [
        req.params.id,
        `${period}-01`,
        amount,
        req.body?.paidAt || storeToday(),
        method,
        emptyToNull(req.body?.notes),
        req.user?.id || null,
      ]
    );
    if (!inserted.rowCount) throw httpError(409, 'Ese vencimiento ya figura como pagado');
    res.status(201).json({ data: inserted.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/payments/:paymentId', async (req, res, next) => {
  try {
    await query('DELETE FROM fixed_expense_payments WHERE id = $1', [req.params.paymentId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function saveExpense(id, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw httpError(400, 'El nombre es obligatorio');
  const amount = money(body.amount);
  if (amount < 0) throw httpError(400, 'El importe no puede ser negativo');
  const frequency = FREQUENCY_MONTHS[body.frequency] ? body.frequency : 'monthly';
  const dueDay = Number(body.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw httpError(400, 'El día de vencimiento va del 1 al 31');
  const startMonth = /^\d{4}-\d{2}$/.test(String(body.startMonth || ''))
    ? `${body.startMonth}-01`
    : `${storeToday().slice(0, 7)}-01`;
  const values = [
    name,
    emptyToNull(body.category),
    emptyToNull(body.payee),
    amount,
    frequency,
    dueDay,
    startMonth,
    emptyToNull(body.notes),
    body.active !== false,
  ];
  if (id) {
    const result = await query(
      `UPDATE fixed_expenses
       SET name = $1, category = $2, payee = $3, amount = $4, frequency = $5, due_day = $6,
           start_month = $7, notes = $8, active = $9
       WHERE id = $10
       RETURNING *`,
      [...values, id]
    );
    if (!result.rowCount) throw httpError(404, 'Gasto no encontrado');
    return result.rows[0];
  }
  const result = await query(
    `INSERT INTO fixed_expenses (name, category, payee, amount, frequency, due_day, start_month, notes, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    values
  );
  return result.rows[0];
}

export default router;
