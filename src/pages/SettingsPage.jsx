import { useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';

export default function SettingsPage() {
  const { settings, reload } = useStore();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const current = form || settings;
  if (!current) return <div className="p-6">Cargando…</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <h1 className="mb-4 text-2xl">Configuración</h1>
      <form
        className="max-w-xl space-y-4"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setError('');
          try {
            await api.saveSettings({
              name: current.name,
              timezone: current.timezone,
              currency: current.currency,
              taxRate: Number(current.tax_rate || 0),
            });
            await reload();
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="field">
          <span>Nombre del comercio</span>
          <input value={current.name} onChange={(e) => setForm({ ...current, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Zona horaria</span>
          <input value={current.timezone} onChange={(e) => setForm({ ...current, timezone: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Moneda</span>
            <input value={current.currency} onChange={(e) => setForm({ ...current, currency: e.target.value })} />
          </label>
          <label className="field">
            <span>IVA / impuesto (%)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={current.tax_rate}
              onChange={(e) => setForm({ ...current, tax_rate: e.target.value })}
            />
          </label>
        </div>
        <button className="pill-btn primary" type="submit">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const empty = { currentPassword: '', newPassword: '', repeat: '' };
  const [state, setState] = useState(empty);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setState({ ...state, [key]: e.target.value });

  return (
    <form
      className="mt-10 max-w-xl space-y-4 border-t border-[#dadce0] pt-6"
      onSubmit={async (ev) => {
        ev.preventDefault();
        setError('');
        setDone(false);
        if (state.newPassword !== state.repeat) {
          setError('Las dos contraseñas nuevas no coinciden');
          return;
        }
        setBusy(true);
        try {
          await api.changePassword({ currentPassword: state.currentPassword, newPassword: state.newPassword });
          setState(empty);
          setDone(true);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="text-lg font-medium">Cambiar contraseña</h2>
        <p className="text-sm text-[#70757a]">Elegí una contraseña de al menos 6 caracteres. Se cierra la sesión en los otros dispositivos.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {done && <div className="rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#137333]">Listo, la contraseña se cambió.</div>}
      <label className="field">
        <span>Contraseña actual</span>
        <input id="pw-current" type="password" autoComplete="current-password" value={state.currentPassword} onChange={set('currentPassword')} required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Contraseña nueva</span>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={6} value={state.newPassword} onChange={set('newPassword')} required />
        </label>
        <label className="field">
          <span>Repetir contraseña nueva</span>
          <input id="pw-repeat" type="password" autoComplete="new-password" minLength={6} value={state.repeat} onChange={set('repeat')} required />
        </label>
      </div>
      <button className="pill-btn primary" type="submit" disabled={busy}>
        Cambiar contraseña
      </button>
    </form>
  );
}
