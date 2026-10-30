import { useEffect, useState } from 'react';
import { api } from '../api';
import { money, qty } from '../format';

const PERIODS = {
  day: { label: 'Día', current: 'Ventas de hoy', previous: 'ayer', chart: 'Últimos 14 días' },
  week: { label: 'Semana', current: 'Ventas de esta semana', previous: 'la semana pasada', chart: 'Últimas 12 semanas' },
  month: { label: 'Mes', current: 'Ventas de este mes', previous: 'el mes pasado', chart: 'Últimos 12 meses' },
};

const WEEKDAYS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function parts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

function shortLabel(period, ymd) {
  const { m, d, wd } = parts(ymd);
  if (period === 'day') return [WEEKDAYS[wd], String(d)];
  if (period === 'week') return [`${d}/${m}`, ''];
  return [MONTHS[m - 1], ''];
}

function longLabel(period, ymd) {
  const { y, m, d, wd } = parts(ymd);
  if (period === 'day') return `${WEEKDAYS[wd]} ${d}/${m}/${y}`;
  if (period === 'week') return `Semana del ${d}/${m}/${y}`;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

function Change({ current, previous, period }) {
  if (!previous) return <span className="text-[#70757a]">Sin ventas {PERIODS[period].previous}</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span className={up ? 'text-[#137333]' : 'text-[#c5221f]'}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)} % {up ? 'más' : 'menos'} que {PERIODS[period].previous}
    </span>
  );
}

export default function SalesPanel({ currency }) {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setHover(null);
    api
      .salesReport(period)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [period]);

  const meta = PERIODS[period];
  const buckets = data?.period === period ? data.buckets : [];
  const max = Math.max(...buckets.map((b) => b.total), 0);
  const active = hover ?? buckets.length - 1;
  const shown = buckets[active];

  return (
    <section className="mb-6 rounded-xl border border-[#dadce0] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-medium">Control de ventas</h2>
        <div className="flex gap-1 rounded-full border border-[#dadce0] p-1" role="tablist" aria-label="Período">
          {Object.entries(PERIODS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              className={`h-8 rounded-full px-4 text-sm font-medium ${period === key ? 'bg-[#1c1c1c] text-white' : 'text-[#3c4043] hover:bg-[#f1f3f4]'}`}
              onClick={() => setPeriod(key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {data?.period === period && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div>
              <div className="kpi-label">{meta.current}</div>
              <div className="kpi-value text-[17px] sm:text-[28px]">{money(data.current.total, currency)}</div>
              <div className="mt-1 text-xs sm:text-sm">
                <Change current={data.current.total} previous={data.previous.total} period={period} />
              </div>
            </div>
            <div>
              <div className="kpi-label">Comprobantes</div>
              <div className="kpi-value text-[17px] sm:text-[22px]">{data.current.count}</div>
              <div className="mt-1 text-xs text-[#70757a] sm:text-sm">
                {data.previous.count} {PERIODS[period].previous}
              </div>
            </div>
            <div>
              <div className="kpi-label">Ticket promedio</div>
              <div className="kpi-value text-[17px] sm:text-[22px]">{money(data.current.average, currency)}</div>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-[#5f6368]">{meta.chart}</span>
            {shown && (
              <span className="tabular-nums" aria-live="polite">
                <span className="capitalize text-[#5f6368]">{longLabel(period, shown.start)}:</span>{' '}
                <b>{money(shown.total, currency)}</b>{' '}
                <span className="text-[#70757a]">
                  · {shown.count} {shown.count === 1 ? 'venta' : 'ventas'}
                </span>
              </span>
            )}
          </div>
          <div className="relative">
            <div className="flex h-40 items-end gap-[3px] border-b border-[#bdc1c6] sm:gap-1" onMouseLeave={() => setHover(null)}>
              {buckets.map((b, i) => {
                const h = max > 0 ? Math.max((b.total / max) * 100, b.total > 0 ? 2 : 0) : 0;
                const isCurrent = i === buckets.length - 1;
                const isActive = i === active;
                return (
                  <button
                    key={b.start}
                    type="button"
                    className="group flex h-full min-w-0 flex-1 items-end"
                    aria-label={`${longLabel(period, b.start)}: ${money(b.total, currency)}, ${b.count} ventas`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onClick={() => setHover(i)}
                  >
                    <span
                      className="block w-full rounded-t-[4px] transition-colors"
                      style={{
                        height: `${h}%`,
                        background: isActive ? '#1c1c1c' : isCurrent ? '#e0a800' : '#f5c518',
                        opacity: isActive || isCurrent ? 1 : 0.75,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex gap-[3px] sm:gap-1">
              {buckets.map((b, i) => {
                const [a, c] = shortLabel(period, b.start);
                return (
                  <div
                    key={b.start}
                    className={`min-w-0 flex-1 text-center text-[11px] leading-tight ${i === active ? 'font-semibold text-[#1c1c1c]' : 'text-[#70757a]'}`}
                  >
                    <div className="truncate">{a}</div>
                    {c && <div>{c}</div>}
                  </div>
                );
              })}
            </div>
            {max === 0 && (
              <div className="absolute inset-x-0 top-12 text-center text-sm text-[#70757a]">Todavía no hay ventas en este período.</div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <button type="button" className="text-sm text-[#8a5a00] underline" onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Ocultar tabla' : 'Ver en tabla'}
            </button>
          </div>
          {showTable && (
            <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-[#dadce0]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...buckets].reverse().map((b) => (
                    <tr key={b.start}>
                      <td className="capitalize">{longLabel(period, b.start)}</td>
                      <td className="text-right tabular-nums">{b.count}</td>
                      <td className="text-right tabular-nums">{money(b.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.top.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-medium text-[#5f6368]">Lo más vendido · {meta.current.replace('Ventas de ', '')}</h3>
              <ol className="grid gap-1 text-sm">
                {data.top.map((t, i) => (
                  <li key={t.name} className="flex items-baseline gap-3 border-b border-[#f1f3f4] py-1.5 last:border-0">
                    <span className="w-4 text-[#70757a] tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="text-[#70757a] tabular-nums">{qty(t.qty)} u.</span>
                    <span className="w-28 text-right font-medium tabular-nums">{money(t.total, currency)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
