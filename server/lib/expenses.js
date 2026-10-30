import { config } from '../config.js';
import { query } from '../db/pool.js';

export const FREQUENCY_MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };

// Fecha de hoy en la zona horaria del comercio (YYYY-MM-DD).
export function storeToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.storeTimezone }).format(new Date());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function monthIndex(ym) {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}

function fromIndex(idx) {
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

// Vence el día elegido, o el último día del mes si ese mes es más corto.
function dueDate(ym, dueDay) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${pad(Math.min(dueDay, last))}`;
}

export function occursIn(expense, ym) {
  const start = monthIndex(expense.start_month.slice(0, 7));
  const idx = monthIndex(ym);
  return idx >= start && (idx - start) % FREQUENCY_MONTHS[expense.frequency] === 0;
}

// Primer vencimiento sin pagar, mirando hasta 12 meses atrás.
export function nextDue(expense, fromYm, paidPeriods = new Set()) {
  const start = monthIndex(expense.start_month.slice(0, 7));
  const step = FREQUENCY_MONTHS[expense.frequency];
  let idx = Math.max(monthIndex(fromYm) - 12, start);
  while ((idx - start) % step !== 0) idx += 1;
  while (paidPeriods.has(fromIndex(idx))) idx += step;
  return dueDate(fromIndex(idx), expense.due_day);
}

function statusFor(due, payment, today) {
  if (payment) return 'paid';
  if (due < today) return 'overdue';
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  return days <= 7 ? 'soon' : 'pending';
}

async function loadExpenses() {
  const result = await query(
    `SELECT id, name, category, payee, amount, frequency, due_day, notes, active,
            to_char(start_month, 'YYYY-MM-DD') AS start_month
     FROM fixed_expenses
     WHERE active = true
     ORDER BY name`
  );
  return result.rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

async function loadPayments(fromYm, toYm) {
  const result = await query(
    `SELECT id, expense_id, to_char(period, 'YYYY-MM') AS period, amount,
            to_char(paid_at, 'YYYY-MM-DD') AS paid_at, method, notes
     FROM fixed_expense_payments
     WHERE period BETWEEN $1::date AND $2::date`,
    [`${fromYm}-01`, `${toYm}-01`]
  );
  const map = new Map();
  for (const row of result.rows) map.set(`${row.expense_id}:${row.period}`, { ...row, amount: Number(row.amount) });
  return map;
}

function occurrence(expense, ym, payments, today) {
  const due = dueDate(ym, expense.due_day);
  const payment = payments.get(`${expense.id}:${ym}`) || null;
  return {
    expenseId: expense.id,
    name: expense.name,
    category: expense.category,
    payee: expense.payee,
    frequency: expense.frequency,
    period: ym,
    due,
    amount: expense.amount,
    status: statusFor(due, payment, today),
    payment,
  };
}

// Vencimientos de un mes, más los impagos de hasta 12 meses atrás.
export async function schedule(ym) {
  const today = storeToday();
  const expenses = await loadExpenses();
  const fromYm = fromIndex(monthIndex(ym) - 12);
  const payments = await loadPayments(fromYm, ym);

  const items = [];
  const overdue = [];
  for (const expense of expenses) {
    if (occursIn(expense, ym)) items.push(occurrence(expense, ym, payments, today));
    for (let idx = monthIndex(ym) - 1; idx >= monthIndex(fromYm); idx -= 1) {
      const past = fromIndex(idx);
      if (!occursIn(expense, past)) continue;
      const occ = occurrence(expense, past, payments, today);
      if (occ.status === 'overdue') overdue.push(occ);
    }
  }
  items.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  overdue.sort((a, b) => a.due.localeCompare(b.due));

  const sum = (list) => Math.round(list.reduce((acc, row) => acc + row.amount, 0) * 100) / 100;
  const paid = items.filter((row) => row.payment);
  return {
    month: ym,
    today,
    items,
    overdue,
    totals: {
      month: sum(items),
      paid: Math.round(paid.reduce((acc, row) => acc + row.payment.amount, 0) * 100) / 100,
      pending: sum(items.filter((row) => !row.payment)),
      overdue: sum([...overdue, ...items.filter((row) => row.status === 'overdue')]),
    },
  };
}
