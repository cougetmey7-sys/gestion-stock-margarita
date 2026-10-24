import { Router } from 'express';
import { query } from '../db/pool.js';

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

    res.json({
      data: {
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

export default router;
