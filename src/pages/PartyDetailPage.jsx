import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import PartyForm, { toPartyForm } from '../components/PartyForm';
import StatusBadge from '../components/StatusBadge';
import { METHODS, money, ymd } from '../format';
import { useStore } from '../store';

const COPY = {
  customers: {
    title: 'Cliente',
    listLabel: 'Clientes',
    back: '/clientes',
    account: '/cuenta-clientes',
    docs: '/ventas',
    get: api.customer,
    save: api.saveCustomer,
    remove: api.deleteCustomer,
    partyLabel: 'Ventas',
    itemLabel: 'cliente',
  },
  suppliers: {
    title: 'Proveedor',
    listLabel: 'Proveedores',
    back: '/proveedores',
    account: '/cuenta-proveedores',
    docs: '/compras',
    get: api.supplier,
    save: api.saveSupplier,
    remove: api.deleteSupplier,
    partyLabel: 'Compras',
    itemLabel: 'proveedor',
  },
};

export default function PartyDetailPage({ kind }) {
  const meta = COPY[kind];
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();
  const [party, setParty] = useState(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await meta.get(id);
    setParty(res.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id, kind]);

  if (!party) return <div className="p-6 text-[#70757a]">{error || 'Cargando…'}</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link className="text-sm text-[#8a5a00]" to={meta.back}>
            ← {meta.listLabel}
          </Link>
          <h1 className="text-2xl">{party.name}</h1>
          <div className="text-sm text-[#70757a]">
            {party.tax_id || 'Sin CUIT'} · {party.phone || 'Sin teléfono'}
          </div>
        </div>
        <Link className="pill-btn inline-flex items-center" to={`${meta.account}/${party.id}`}>
          Cuenta corriente
        </Link>
        <button className="pill-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="pill-btn danger" onClick={() => setRemoving(true)}>
          Borrar
        </button>
      </div>
      <div className="mb-6 kpi-card max-w-xs">
        <div className="kpi-label">Saldo</div>
        <div className="kpi-value">{money(party.balance, currency)}</div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-medium">{meta.partyLabel}</h2>
          <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(party.documents || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="text-[#8a5a00]" to={`${meta.docs}/${row.id}`}>
                        {row.number}
                      </Link>
                    </td>
                    <td>{ymd(row.issued_at)}</td>
                    <td>{money(row.total, currency)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
                {!party.documents?.length && (
                  <tr>
                    <td className="py-8 text-center text-[#70757a]" colSpan={4}>
                      Sin comprobantes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">Pagos</h2>
          <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {(party.payments || []).map((row) => (
                  <tr key={row.id}>
                    <td>{ymd(row.paid_at)}</td>
                    <td>{METHODS[row.method] || row.method}</td>
                    <td>{money(row.amount, currency)}</td>
                  </tr>
                ))}
                {!party.payments?.length && (
                  <tr>
                    <td className="py-8 text-center text-[#70757a]" colSpan={3}>
                      Sin pagos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${party.name}`}
          message={`Se va a borrar el ${meta.itemLabel} ${party.name}. Los comprobantes asociados quedan sin ${meta.itemLabel}.`}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await meta.remove(party.id);
            navigate(meta.back);
          }}
        />
      )}
      {editing && (
        <PartyForm
          title={`Editar ${meta.title.toLowerCase()}`}
          form={toPartyForm(party)}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            await meta.save(party.id, body);
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
