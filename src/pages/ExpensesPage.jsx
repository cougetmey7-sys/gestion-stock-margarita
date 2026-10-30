import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import PaymentModal from '../components/PaymentModal';
import { METHODS, money } from '../format';
import { useStore } from '../store';

export const FREQUENCIES = {
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

const STATUS = {
  paid: { label: 'Pagado', cls: 'badge-confirmed' },
  overdue: { label: 'Vencido', cls: 'badge-cancelled' },
  soon: { label: 'Vence pronto', cls: 'badge-low' },
  pending: { label: 'Pendiente', cls: 'badge-draft' },
};

const CATEGORIES = ['Alquiler', 'Servicios', 'Impuestos', 'Sueldos', 'Seguros', 'Préstamos', 'Otros'];

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fullDate(ymd) {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function shortDate(ymd) {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d}/${m}`;
}

export function ExpenseStatus({ status }) {
  const s = STATUS[status];
  return <span className={`badge whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

export default function ExpensesPage() {
  const { currency } = useStore();
  const [tab, setTab] = useState('schedule');
  const [month, setMonth] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [list, setList] = useState(null);
  const [paying, setPaying] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [undoing, setUndoing] = useState(null);
  const [error, setError] = useState('');

  async function loadSchedule(target = month) {
    const res = await api.expenseSchedule(target || '');
    setSchedule(res.data);
    if (!target) setMonth(res.data.month);
  }

  async function loadList() {
    const res = await api.expenses();
    setList(res);
  }

  async function reload() {
    await Promise.all([loadSchedule(), loadList()]);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, []);

  function goMonth(delta) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    loadSchedule(next).catch((err) => setError(err.message));
  }

  const hasExpenses = list && list.data.length > 0;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Gastos fijos</h1>
        <button className="pill-btn primary" type="button" onClick={() => setEditing({})}>
          Nuevo gasto fijo
        </button>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex gap-2" role="tablist">
        {[
          ['schedule', 'Vencimientos'],
          ['list', 'Mis gastos fijos'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`sitemap-btn ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {list && !hasExpenses && (
        <div className="rounded-xl border border-dashed border-[#dadce0] p-8 text-center">
          <div className="text-lg">Todavía no cargaste gastos fijos</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#70757a]">
            Cargá el alquiler, la luz, internet, impuestos o sueldos con su día de vencimiento, y acá vas a ver qué
            tenés que pagar cada mes.
          </p>
          <button className="pill-btn primary mt-4" type="button" onClick={() => setEditing({})}>
            Cargar el primer gasto
          </button>
        </div>
      )}

      {hasExpenses && tab === 'schedule' && schedule && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <button className="icon-btn" type="button" onClick={() => goMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-[150px] text-center text-lg font-medium capitalize">{monthLabel(schedule.month)}</div>
            <button className="icon-btn" type="button" onClick={() => goMonth(1)} aria-label="Mes siguiente">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="kpi-card">
              <div className="kpi-label">Total del mes</div>
              <div className="kpi-value">{money(schedule.totals.month, currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pagado</div>
              <div className="kpi-value text-[#137333]">{money(schedule.totals.paid, currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Falta pagar</div>
              <div className="kpi-value">{money(schedule.totals.pending, currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Vencido sin pagar</div>
              <div className={`kpi-value ${schedule.totals.overdue > 0 ? 'text-[#c5221f]' : ''}`}>
                {money(schedule.totals.overdue, currency)}
              </div>
            </div>
          </div>

          {schedule.overdue.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-medium text-[#c5221f]">Atrasados de meses anteriores</h2>
              <ScheduleTable rows={schedule.overdue} currency={currency} onPay={setPaying} onUndo={setUndoing} showPeriod />
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg font-medium">
              Vencimientos de <span className="capitalize">{monthLabel(schedule.month)}</span>
            </h2>
            <ScheduleTable rows={schedule.items} currency={currency} onPay={setPaying} onUndo={setUndoing} />
          </section>
        </>
      )}

      {hasExpenses && tab === 'list' && (
        <>
          <div className="mb-4 text-sm text-[#5f6368]">
            Promedio mensual de gastos fijos activos:{' '}
            <b className="text-[#1c1c1c]">{money(list.totals.monthlyAverage, currency)}</b>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gasto</th>
                  <th>Categoría</th>
                  <th>Frecuencia</th>
                  <th>Vence el día</th>
                  <th>Próximo a pagar</th>
                  <th className="text-right">Importe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id} className={row.active ? '' : 'opacity-50'}>
                    <td>
                      <div className="font-medium">{row.name}</div>
                      {row.payee && <div className="text-xs text-[#70757a]">{row.payee}</div>}
                    </td>
                    <td>{row.category || '—'}</td>
                    <td>{FREQUENCIES[row.frequency]}</td>
                    <td>{row.due_day}</td>
                    <td className="whitespace-nowrap">
                      {row.active ? (
                        <span className={row.overdue ? 'font-medium text-[#c5221f]' : ''}>
                          {fullDate(row.next_due)}
                          {row.overdue ? ' · vencido' : ''}
                        </span>
                      ) : (
                        'Pausado'
                      )}
                    </td>
                    <td className="text-right tabular-nums">{money(row.amount, currency)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="pill-btn" type="button" onClick={() => setEditing(row)}>
                          Editar
                        </button>
                        <button className="pill-btn danger" type="button" onClick={() => setRemoving(row)}>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {paying && (
        <PaymentModal
          title={`Pagar ${paying.name} · ${monthLabel(paying.period)}`}
          remaining={paying.amount}
          onClose={() => setPaying(null)}
          onSave={async (body) => {
            await api.payExpense(paying.expenseId, { ...body, period: paying.period });
            setPaying(null);
            await reload();
          }}
        />
      )}
      {undoing && (
        <ConfirmDangerModal
          title="Anular pago"
          confirmLabel="Anular pago"
          message={`Se va a anular el pago de ${undoing.name} de ${monthLabel(undoing.period)} y vuelve a figurar como pendiente.`}
          onClose={() => setUndoing(null)}
          onConfirm={async () => {
            await api.deleteExpensePayment(undoing.payment.id);
            setUndoing(null);
            await reload();
          }}
        />
      )}
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${removing.name}`}
          message="Se borra el gasto fijo y todo su historial de pagos. Si solo dejó de pagarse, conviene pausarlo desde Editar."
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.deleteExpense(removing.id);
            setRemoving(null);
            await reload();
          }}
        />
      )}
      {editing && (
        <ExpenseForm
          expense={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveExpense(editing.id, body);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function ScheduleTable({ rows, currency, onPay, onUndo, showPeriod }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
      <table className="data-table">
        <thead>
          <tr>
            <th>Vence</th>
            <th>Gasto</th>
            <th>Estado</th>
            <th>Pago</th>
            <th className="text-right">Importe</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.expenseId}-${row.period}`}>
              <td className="whitespace-nowrap font-medium tabular-nums">
                {shortDate(row.due)}
                {showPeriod && <div className="text-xs font-normal capitalize text-[#70757a]">{monthLabel(row.period)}</div>}
              </td>
              <td>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-[#70757a]">
                  {[row.category, row.payee, FREQUENCIES[row.frequency]].filter(Boolean).join(' · ')}
                </div>
              </td>
              <td>
                <ExpenseStatus status={row.status} />
              </td>
              <td className="text-sm text-[#5f6368]">
                {row.payment
                  ? `${shortDate(row.payment.paid_at)} · ${METHODS[row.payment.method] || row.payment.method}`
                  : '—'}
              </td>
              <td className="text-right tabular-nums">{money(row.payment ? row.payment.amount : row.amount, currency)}</td>
              <td className="text-right">
                {row.payment ? (
                  <button className="pill-btn whitespace-nowrap" type="button" onClick={() => onUndo(row)}>
                    Anular
                  </button>
                ) : (
                  <button className="pill-btn primary whitespace-nowrap" type="button" onClick={() => onPay(row)}>
                    Marcar pagado
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="py-8 text-center text-[#70757a]" colSpan={6}>
                No hay vencimientos este mes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseForm({ expense, onClose, onSave }) {
  const [state, setState] = useState({
    name: expense.name || '',
    category: expense.category || '',
    payee: expense.payee || '',
    amount: expense.amount ?? '',
    frequency: expense.frequency || 'monthly',
    dueDay: expense.due_day || 10,
    startMonth: (expense.start_month || new Date().toISOString()).slice(0, 7),
    notes: expense.notes || '',
    active: expense.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setState((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({ ...state, amount: Number(state.amount), dueDay: Number(state.dueDay) });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{expense.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Nombre</span>
            <input id="expense-name" value={state.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Alquiler del local" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Categoría</span>
              <input id="expense-category" list="expense-categories" value={state.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>A quién se paga</span>
              <input id="expense-payee" value={state.payee} onChange={(e) => set('payee', e.target.value)} placeholder="Ej. DPEC" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Importe</span>
              <input id="expense-amount" type="number" min="0" step="0.01" value={state.amount} onChange={(e) => set('amount', e.target.value)} required />
            </label>
            <label className="field">
              <span>Frecuencia</span>
              <select id="expense-frequency" value={state.frequency} onChange={(e) => set('frequency', e.target.value)}>
                {Object.entries(FREQUENCIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Día de vencimiento</span>
              <input id="expense-due-day" type="number" min="1" max="31" value={state.dueDay} onChange={(e) => set('dueDay', e.target.value)} required />
            </label>
            <label className="field">
              <span>Primer vencimiento (mes)</span>
              <input id="expense-start" type="month" value={state.startMonth} onChange={(e) => set('startMonth', e.target.value)} required />
            </label>
          </div>
          <label className="field">
            <span>Notas</span>
            <input id="expense-notes" value={state.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej. N° de cliente, CBU" />
          </label>
          {expense.id && (
            <label className="flex items-center gap-2 text-sm">
              <input id="expense-active" type="checkbox" checked={state.active} onChange={(e) => set('active', e.target.checked)} />
              Activo (desmarcalo para pausarlo sin perder el historial)
            </label>
          )}
          <p className="text-xs text-[#70757a]">
            Si el mes tiene menos días que el de vencimiento, vence el último día del mes.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
