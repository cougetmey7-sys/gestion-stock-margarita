import crypto from 'crypto';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const CACHE_MS = 30 * 1000;
let cached = null;

export function hashKey(code) {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}

// active: sin prueba configurada o con código válido · trial: dentro del plazo · expired: venció
export async function getLicense() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.state;
  const state = await computeLicense();
  cached = { at: Date.now(), state };
  return state;
}

export function clearLicenseCache() {
  cached = null;
}

async function computeLicense() {
  const base = { supportContact: config.supportContact || null };
  if (!config.trialEndsAt) return { ...base, status: 'active' };

  const result = await query('SELECT license_key_hash FROM store_settings WHERE id = 1');
  const stored = result.rows[0]?.license_key_hash;
  if (config.licenseKey && stored && stored === hashKey(config.licenseKey)) {
    return { ...base, status: 'active' };
  }

  const msLeft = config.trialEndsAt.getTime() - Date.now();
  const trialEndsAt = config.trialEndsAt.toISOString();
  if (msLeft > 0) {
    return { ...base, status: 'trial', trialEndsAt, daysLeft: Math.ceil(msLeft / 86400000) };
  }
  return { ...base, status: 'expired', trialEndsAt };
}

export async function requireLicense(_req, res, next) {
  try {
    const license = await getLicense();
    if (license.status === 'expired') {
      return res.status(402).json({ error: 'El período de prueba finalizó', code: 'trial_expired' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
