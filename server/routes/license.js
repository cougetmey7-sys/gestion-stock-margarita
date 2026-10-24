import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { clearLicenseCache, getLicense, hashKey } from '../lib/license.js';

const router = Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function sameKey(a, b) {
  const ha = Buffer.from(hashKey(a), 'hex');
  const hb = Buffer.from(hashKey(b), 'hex');
  return crypto.timingSafeEqual(ha, hb);
}

router.get('/', async (_req, res, next) => {
  try {
    res.json({ data: await getLicense() });
  } catch (err) {
    next(err);
  }
});

router.post('/activate', async (req, res, next) => {
  try {
    if (tooManyAttempts(req.ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
    }
    const code = String(req.body?.code || '').trim();
    if (!code || !config.licenseKey || !sameKey(code, config.licenseKey)) {
      return res.status(400).json({ error: 'Código de activación incorrecto' });
    }
    await query('UPDATE store_settings SET license_key_hash = $1, updated_at = now() WHERE id = 1', [
      hashKey(config.licenseKey),
    ]);
    clearLicenseCache();
    attempts.delete(req.ip);
    res.json({ data: await getLicense() });
  } catch (err) {
    next(err);
  }
});

export default router;
