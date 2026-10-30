import { Router } from 'express';
import { query } from '../db/pool.js';
import { schedule, storeToday } from '../lib/expenses.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [sales, purchases, stock, receivable, payable, recentSales] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
         FROM sales
         WHERE status = 'confirmed' AND issued_at >= date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS count
         FROM purchases
         WHERE status = 'confirmed' AND issued_at >= date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(stock_qty * cost_price), 0)::numeric AS cost_value,
                COALESCE(SUM(stock_qty * sale_price), 0)::numeric AS sale_value
         FROM products WHERE active = true`
      ),
      query(
        `SELECT COALESCE(SUM(total - paid), 0)::numeric AS total
         FROM sales WHERE status = 'confirmed' AND total > paid`
      ),
      query(
        `SELECT COALESCE(SUM(total - paid), 0)::numeric AS total
         FROM purchases WHERE status = 'confirmed' AND total > paid`
      ),
      query(
        `SELECT s.id, s.number, s.issued_at, s.total, s.paid, s.status, c.name AS customer_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         ORDER BY s.created_at DESC
         LIMIT 6`
      ),
    ]);

    const expenses = await schedule(storeToday().slice(0, 7));
    const upcoming = [...expenses.overdue, ...expenses.items.filter((row) => !row.payment)].slice(0, 6);

    res.json({
      data: {
        expenses: { totals: expenses.totals, upcoming },
        salesMonth: sales.rows[0],
        purchasesMonth: purchases.rows[0],
        stock: stock.rows[0],
        receivable: receivable.rows[0].total,
        payable: payable.rows[0].total,
        recentSales: recentSales.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

const PERIODS = {
  day: { unit: 'day', step: '1 day', count: 14 },
  week: { unit: 'week', step: '1 week', count: 12 },
  month: { unit: 'month', step: '1 month', count: 12 },
};

// Ventas confirmadas por día, semana o mes, con el período actual, el anterior y lo más vendido.
router.get('/sales', async (req, res, next) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : 'day';
    const { unit, step, count } = PERIODS[period];
    const today = storeToday();
    const buckets = await query(
      `WITH b AS (
         SELECT generate_series(
           date_trunc('${unit}', $1::date) - interval '${step}' * ${count - 1},
           date_trunc('${unit}', $1::date),
           interval '${step}'
         )::date AS start
       )
       SELECT to_char(b.start, 'YYYY-MM-DD') AS start,
              COALESCE(SUM(s.total), 0)::numeric AS total,
              COUNT(s.id)::int AS count
       FROM b
       LEFT JOIN sales s ON s.status = 'confirmed' AND date_trunc('${unit}', s.issued_at)::date = b.start
       GROUP BY b.start
       ORDER BY b.start`,
      [today]
    );
    const rows = buckets.rows.map((row) => ({ ...row, total: Number(row.total) }));
    const current = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    const top = await query(
      `SELECT si.description AS name, SUM(si.qty)::numeric AS qty, SUM(si.line_total)::numeric AS total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'confirmed' AND date_trunc('${unit}', s.issued_at)::date = $1::date
       GROUP BY si.description
       ORDER BY SUM(si.line_total) DESC
       LIMIT 5`,
      [current.start]
    );
    res.json({
      data: {
        period,
        today,
        buckets: rows,
        current: { ...current, average: current.count ? current.total / current.count : 0 },
        previous,
        top: top.rows.map((row) => ({ ...row, qty: Number(row.qty), total: Number(row.total) })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
