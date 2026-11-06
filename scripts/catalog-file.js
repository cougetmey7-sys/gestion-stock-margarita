import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

// Lee un catálogo de scripts/data: JSON comprimido con gzip y cifrado con AES-256-GCM
// (iv de 12 bytes + tag de 16 + datos, en base64), para que los costos no queden legibles.
export function readCatalog(fileName, keyHex) {
  if (!keyHex) return [];
  const raw = Buffer.from(fs.readFileSync(path.join(DATA_DIR, path.basename(fileName)), 'utf8'), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const gz = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
  return JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
}
