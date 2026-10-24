import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

export const config = {
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, 'uploads'),
  storeTimezone: process.env.STORE_TIMEZONE || 'America/Argentina/Buenos_Aires',
  storeName: process.env.STORE_NAME || 'Margarita Polirrubro',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  seedDemo: String(process.env.SEED_DEMO || 'true').toLowerCase() !== 'false',
  nodeEnv: process.env.NODE_ENV || 'development',
  trialEndsAt: parseTrialEnd(process.env.TRIAL_ENDS_AT),
  licenseKey: (process.env.LICENSE_KEY || '').trim(),
  supportContact: (process.env.SUPPORT_CONTACT || '').trim(),
};

// TRIAL_ENDS_AT acepta "2026-10-31" (vence al final de ese día, hora Argentina) o un ISO completo.
function parseTrialEnd(value) {
  const raw = (value || '').trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59-03:00` : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`TRIAL_ENDS_AT inválido: ${raw}`);
  }
  return date;
}

export function assertRuntimeConfig() {
  if (!config.databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
}
