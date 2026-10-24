import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import TrialExpiredPage from './pages/TrialExpiredPage';

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(null);

  const reload = useCallback(async () => {
    try {
      const res = await api.license();
      setLicense(res.data);
    } catch {
      setLicense({ status: 'active' });
    }
  }, []);

  useEffect(() => {
    reload();
    const onExpired = () => reload();
    window.addEventListener('license-expired', onExpired);
    return () => window.removeEventListener('license-expired', onExpired);
  }, [reload]);

  const value = useMemo(() => ({ license, reload, setLicense }), [license, reload]);

  if (!license) {
    return <div className="grid min-h-full place-items-center text-[#70757a]">Cargando…</div>;
  }

  return (
    <LicenseContext.Provider value={value}>
      {license.status === 'expired' ? <TrialExpiredPage /> : children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider');
  return ctx;
}
