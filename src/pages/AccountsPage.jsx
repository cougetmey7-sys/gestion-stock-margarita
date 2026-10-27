import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PaymentModal from '../components/PaymentModal';
import { money } from '../format';
import { useStore } from '../store';

export const ACCOUNT_COPY = {
  customers: {
    title: 'Cuenta corriente de clientes',
    path: '/cuenta-clientes',
    partyPath: '/clientes',
    totalLabel: 'Total a cobrar',
    party: 'Cliente',
    payLabel: 'Registrar cobro',
    receiptLabel: 'Recibo',
    docLabel: 'Venta',
    docsPath: '/ventas',
    empty: 'Ningún cliente debe dinero.',
  },
  suppliers: {
    title: 'Cuenta corriente de proveedores',
    path: '/cuenta-proveedores',
    partyPath: '/proveedores',
    totalLabel: 'Total a pagar',
    party: 'Proveedor',
    payLabel: 'Registrar pago',
    receiptLabel: 'Orden de pago',
    docLabel: 'Compra',
    docsPath: '/compras',
    empty: 'No le debés dinero a ningún proveedor.',
  },
};

export function daysLabel(days) {
  if (days === 0) return 'Hoy';
  return days === 1 ? '1 día' : `${days} días`;
}

export function AgeBadge({ days }) {
  if (days == null) return <span className="text-[#70757a]">—</span>;
  const cls = days > 30 ? 'badge-cancelled' : days > 15 ? 'badge-low' : 'badge-draft';
  return <span className={`badge whitespace-nowrap ${cls}`}>{daysLabel(days)}</span>;
}

export default function AccountsPage({ kind }) {
  const meta = ACCOUNT_COPY[kind];
  const { currency } = useStore();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [paying, setPaying] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load(term = q) {
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    const res = await api.accounts(kind, `?${params.toString()}`);
    setData(res);
  }

  useEffect(() => {
    setNotice('');
    const handle = setTimeout(() => {
      load(q).catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, kind]);

  const rows = (data?.data || []).filter((row) => !onlyDebt || row.balance > 0);
  const totals = data?.totals;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{meta.title}</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#e0a800] sm:w-auto sm:min-w-[240px]"
          placeholder="Buscar por nombre, CUIT o teléfono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-[#3c4043]">
          <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
          Solo con saldo
        </label>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]">{notice}</div>}
      {totals && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="kpi-card">
            <div className="kpi-label">{meta.totalLabel}</div>
            <div className="kpi-value">{money(totals.balance, currency)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Cuentas con saldo</div>
            <div className="kpi-value">{totals.accounts}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Con más de 30 días</div>
            <div className="kpi-value">{money(totals.overdue30, currency)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Deuda más antigua</div>
            <div className="kpi-value">{totals.accounts ? daysLabel(totals.oldestDays) : '—'}</div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
        <table className="data-table">
          <thead>
            <tr>
              <th>{meta.party}</th>
              <th>Teléfono</th>
              <th>Pendientes</th>
              <th>Antigüedad</th>
              <th>Último pago</th>
              <th className="text-right">Saldo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="font-medium text-[#8a5a00]" to={`${meta.path}/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{row.phone || '—'}</td>
                <td>{row.pending_docs || '—'}</td>
                <td>
                  <AgeBadge days={row.balance > 0 ? row.oldest_days : null} />
                </td>
                <td className="whitespace-nowrap">{row.last_payment || '—'}</td>
                <td className="text-right font-semibold tabular-nums">{money(row.balance, currency)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {row.balance > 0 && (
                      <button className="pill-btn primary whitespace-nowrap" type="button" onClick={() => setPaying(row)}>
                        {meta.payLabel}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data && !rows.length && (
              <tr>
                <td className="py-8 text-center text-[#70757a]" colSpan={7}>
                  {onlyDebt ? meta.empty : 'Sin resultados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paying && (
        <PaymentModal
          title={`${meta.payLabel} · ${paying.name}`}
          remaining={paying.balance}
          onClose={() => setPaying(null)}
          onSave={async (body) => {
            const res = await api.payAccount(kind, paying.id, body);
            setNotice(
              `${res.data.receipt.label} ${res.data.receipt.number} por ${money(res.data.receipt.amount, currency)} registrado para ${paying.name}.`
            );
            setPaying(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
