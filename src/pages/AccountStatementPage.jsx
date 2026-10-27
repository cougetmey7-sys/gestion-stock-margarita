import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Printer } from 'lucide-react';
import { api } from '../api';
import PaymentModal from '../components/PaymentModal';
import { METHODS, money } from '../format';
import { printStatement } from '../lib/ticket';
import { useStore } from '../store';
import { ACCOUNT_COPY, AgeBadge, daysLabel } from './AccountsPage';

function concept(meta, row) {
  if (row.type === 'doc') return `${meta.docLabel} ${row.ref}`;
  const label = row.ref.startsWith('#') ? 'Pago' : `${meta.receiptLabel} ${row.ref}`;
  const parts = [label, METHODS[row.method] || row.method];
  if (row.docs) parts.push(`aplicado a ${row.docs}`);
  return parts.filter(Boolean).join(' · ');
}

// Números argentinos sin código de país: se completa con 549 para wa.me.
function whatsappUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const full = digits.startsWith('54') ? digits : `549${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export default function AccountStatementPage({ kind }) {
  const meta = ACCOUNT_COPY[kind];
  const { id } = useParams();
  const { settings, currency } = useStore();
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await api.account(kind, id, `?${params.toString()}`);
    setData(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id, kind, from, to]);

  if (!data) return <div className="p-6 text-[#70757a]">{error || 'Cargando…'}</div>;

  const { party, movements, pending, balance, opening } = data;
  const lastBalance = movements.length ? movements[movements.length - 1].balance : opening;
  const storeName = settings?.name || '';
  const reminder =
    kind === 'customers' && balance > 0
      ? whatsappUrl(
          party.phone,
          `Hola ${party.name}! Te escribimos de ${storeName}. Tu saldo en cuenta corriente es de ${money(balance, currency)}. Cualquier consulta, avisanos. ¡Gracias!`
        )
      : null;
  const range = from || to ? `${from || 'inicio'} a ${to || 'hoy'}` : '';

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link className="text-sm text-[#8a5a00]" to={meta.path}>
            ← {meta.title}
          </Link>
          <h1 className="text-2xl">{party.name}</h1>
          <div className="text-sm text-[#70757a]">
            {party.tax_id || 'Sin CUIT'} · {party.phone || 'Sin teléfono'} ·{' '}
            <Link className="text-[#8a5a00]" to={`${meta.partyPath}/${party.id}`}>
              Ver ficha
            </Link>
          </div>
        </div>
        <button
          className="pill-btn inline-flex items-center gap-2"
          type="button"
          onClick={() =>
            printStatement({
              storeName,
              title: 'Resumen de cuenta corriente',
              party,
              movements: movements.map((row) => ({ ...row, concept: concept(meta, row) })),
              opening,
              balance: lastBalance,
              currency,
              range,
            })
          }
        >
          <Printer size={16} /> Imprimir resumen
        </button>
        {reminder && (
          <a className="pill-btn inline-flex items-center gap-2" href={reminder} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> Recordar por WhatsApp
          </a>
        )}
        {balance > 0 && (
          <button className="pill-btn primary" type="button" onClick={() => setPaying(true)}>
            {meta.payLabel}
          </button>
        )}
      </div>
      {notice && <div className="mb-4 rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]">{notice}</div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="kpi-label">Saldo actual</div>
          <div className="kpi-value">{money(balance, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Comprobantes pendientes</div>
          <div className="kpi-value">{pending.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Deuda más antigua</div>
          <div className="kpi-value">{pending.length ? daysLabel(pending[0].days) : '—'}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <h2 className="mr-auto text-lg font-medium">Movimientos</h2>
            <label className="field">
              <span>Desde</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {from && (
                  <tr>
                    <td>{from}</td>
                    <td className="text-[#70757a]">Saldo anterior</td>
                    <td />
                    <td />
                    <td className="text-right tabular-nums">{money(opening, currency)}</td>
                  </tr>
                )}
                {movements.map((row) => (
                  <tr key={`${row.type}-${row.ref_id}`}>
                    <td className="whitespace-nowrap">{row.date}</td>
                    <td>
                      {row.type === 'doc' ? (
                        <Link className="text-[#8a5a00]" to={`${meta.docsPath}/${row.ref_id}`}>
                          {concept(meta, row)}
                        </Link>
                      ) : (
                        concept(meta, row)
                      )}
                      {row.notes && <div className="text-xs text-[#70757a]">{row.notes}</div>}
                    </td>
                    <td className="text-right tabular-nums">{row.debit ? money(row.debit, currency) : ''}</td>
                    <td className="text-right tabular-nums text-[#137333]">
                      {row.credit ? money(row.credit, currency) : ''}
                    </td>
                    <td className="text-right font-medium tabular-nums">{money(row.balance, currency)}</td>
                  </tr>
                ))}
                {!movements.length && (
                  <tr>
                    <td className="py-8 text-center text-[#70757a]" colSpan={5}>
                      Sin movimientos en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-medium">Comprobantes pendientes</h2>
          <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Antigüedad</th>
                  <th className="text-right">Debe</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="text-[#8a5a00]" to={`${meta.docsPath}/${row.id}`}>
                        {row.number}
                      </Link>
                      <div className="whitespace-nowrap text-xs text-[#70757a]">{row.date}</div>
                    </td>
                    <td>
                      <AgeBadge days={row.days} />
                    </td>
                    <td className="text-right tabular-nums">{money(row.remaining, currency)}</td>
                  </tr>
                ))}
                {!pending.length && (
                  <tr>
                    <td className="py-8 text-center text-[#70757a]" colSpan={3}>
                      Cuenta al día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[#70757a]">
            Los pagos a cuenta se aplican primero a los comprobantes más viejos.
          </p>
        </section>
      </div>

      {paying && (
        <PaymentModal
          title={`${meta.payLabel} · ${party.name}`}
          remaining={balance}
          onClose={() => setPaying(false)}
          onSave={async (body) => {
            const res = await api.payAccount(kind, party.id, body);
            setNotice(
              `${res.data.receipt.label} ${res.data.receipt.number} por ${money(res.data.receipt.amount, currency)} registrado.`
            );
            setPaying(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
