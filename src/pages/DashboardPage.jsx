import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { money } from '../format';
import { useStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import { ExpenseStatus } from './ExpensesPage';

export default function DashboardPage() {
  const { currency } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard().then((res) => setData(res.data)).catch((err) => setError(err.message));
  }, []);

  if (!data && !error) return <div className="p-6 text-[#70757a]">Cargando…</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-4 text-2xl">Inicio</h1>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Ventas del mes" value={money(data.salesMonth.total, currency)} hint={`${data.salesMonth.count} comprobantes`} />
            <Kpi label="Compras del mes" value={money(data.purchasesMonth.total, currency)} hint={`${data.purchasesMonth.count} comprobantes`} />
            <Kpi label="Stock a costo" value={money(data.stock.cost_value, currency)} hint={`A venta ${money(data.stock.sale_value, currency)}`} />
            <Kpi label="Por cobrar" value={money(data.receivable, currency)} hint="Saldo de clientes" />
            <Kpi label="Por pagar" value={money(data.payable, currency)} hint="Saldo a proveedores" />
            {data.expenses.totals.month > 0 && (
              <Kpi
                label="Gastos fijos del mes"
                value={money(data.expenses.totals.month, currency)}
                hint={`Falta pagar ${money(data.expenses.totals.pending, currency)}`}
              />
            )}
          </div>
          {data.expenses.upcoming.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Gastos fijos a pagar</h2>
                <Link className="text-sm text-[#8a5a00]" to="/gastos-fijos">
                  Ver vencimientos
                </Link>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vence</th>
                      <th>Gasto</th>
                      <th>Estado</th>
                      <th className="text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.upcoming.map((row) => (
                      <tr key={`${row.expenseId}-${row.period}`}>
                        <td className="whitespace-nowrap tabular-nums">{row.due}</td>
                        <td>{row.name}</td>
                        <td>
                          <ExpenseStatus status={row.status} />
                        </td>
                        <td className="text-right tabular-nums">{money(row.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Últimas ventas</h2>
                <Link className="text-sm text-[#8a5a00]" to="/ventas">
                  Ver todas
                </Link>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSales.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className="text-[#8a5a00]" to={`/ventas/${row.id}`}>
                            {row.number}
                          </Link>
                        </td>
                        <td>{row.customer_name || 'Consumidor final'}</td>
                        <td>{money(row.total, currency)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                    {!data.recentSales.length && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#70757a]">
                          Todavía no hay ventas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 text-xs text-[#70757a]">{hint}</div>
    </div>
  );
}
