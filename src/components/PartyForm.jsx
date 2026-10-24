import { useState } from 'react';

export default function PartyForm({ title, form, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

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
            await onSave(state);
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">{title}</div>
        <div className="grid gap-3 px-5 py-4">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>CUIT / DNI</span>
              <input value={state.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input value={state.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input value={state.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="field">
            <span>Dirección</span>
            <input value={state.address} onChange={(e) => set('address', e.target.value)} />
          </label>
          <label className="field">
            <span>Notas</span>
            <textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
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

export function emptyParty() {
  return { id: null, name: '', taxId: '', phone: '', email: '', address: '', notes: '' };
}

export function toPartyForm(row) {
  return {
    id: row.id,
    name: row.name || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    notes: row.notes || '',
  };
}
