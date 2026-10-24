import { useState } from 'react';
import { useAuth } from '../auth';
import PoweredBy from '../components/PoweredBy';
import { Navigate } from 'react-router-dom';
import { Clock, MapPin, Phone } from 'lucide-react';
import { BRAND } from '../brand';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#1c1c1c]">
      <div className="grid flex-1 place-items-center p-4">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl border-t-8 border-[#f5c518] bg-white p-5 shadow-xl sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <img src={BRAND.logo} alt={BRAND.name} className="mb-3 h-28 w-28 rounded-full shadow-md" />
            <div className="text-2xl font-semibold text-[#1c1c1c]">{BRAND.name}</div>
            <div className="text-sm text-[#70757a]">Gestión de stock · ventas, compras y precios</div>
          </div>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field mb-3">
            <span>Usuario</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="field mb-5">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-[#1c1c1c] font-medium text-white disabled:opacity-60"
            disabled={busy}
          >
            Ingresar
          </button>
          <div className="mt-6 space-y-1.5 border-t border-[#dadce0] pt-4 text-xs text-[#5f6368]">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="shrink-0" /> {BRAND.location}
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0" /> {BRAND.phone}
            </div>
            {BRAND.hours.map(([days, time]) => (
              <div key={days} className="flex items-start gap-2">
                <Clock size={14} className="mt-0.5 shrink-0" />
                <span>
                  <b className="font-medium">{days}:</b> {time}
                </span>
              </div>
            ))}
          </div>
        </form>
      </div>
      <PoweredBy />
    </div>
  );
}
