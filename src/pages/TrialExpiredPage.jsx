import { useState } from 'react';
import { KeyRound, MessageCircle } from 'lucide-react';
import { api } from '../api';
import { BRAND } from '../brand';
import { useLicense } from '../license';
import PoweredBy from '../components/PoweredBy';

export default function TrialExpiredPage() {
  const { license, setLicense } = useLicense();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.activateLicense(code);
      setLicense(res.data);
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
            <img src={BRAND.logo} alt={BRAND.name} className="mb-3 h-24 w-24 rounded-full shadow-md" />
            <div className="text-xl font-semibold text-[#1c1c1c]">Tu período de prueba finalizó</div>
            <p className="mt-2 text-sm text-[#5f6368]">
              Gracias por probar el sistema. Tus datos están guardados. Para seguir usándolo, ingresá el código de
              activación.
            </p>
          </div>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="field mb-5">
            <span>Código de activación</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="XXXX-XXXX"
            />
          </label>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1c1c1c] font-medium text-white disabled:opacity-60"
            disabled={busy || !code.trim()}
          >
            <KeyRound size={18} /> Activar
          </button>
          {license?.supportContact ? (
            <a
              href={whatsappUrl(license.supportContact)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#25d366] font-medium text-[#128c4a]"
            >
              <MessageCircle size={18} /> Pedir el código por WhatsApp
            </a>
          ) : (
            <p className="mt-5 text-center text-xs text-[#70757a]">
              ¿No tenés el código? Comunicate con quien te instaló el sistema.
            </p>
          )}
        </form>
      </div>
      <PoweredBy />
    </div>
  );
}

// Números argentinos sin código de país: se completa con 549 para wa.me.
function whatsappUrl(contact) {
  const digits = contact.replace(/\D/g, '');
  const full = digits.startsWith('54') ? digits : `549${digits}`;
  const text = encodeURIComponent('Hola, terminó la prueba del sistema de stock de Margarita Polirrubro y quiero activarlo.');
  return `https://wa.me/${full}?text=${text}`;
}
