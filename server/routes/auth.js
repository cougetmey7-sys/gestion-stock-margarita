import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { login, logout, readToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const data = await login(username, password);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  res.json({ user: req.user });
});

router.post('/logout', async (req, res, next) => {
  try {
    await logout(readToken(req) || req.token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Cambia la contraseña del usuario actual y cierra sus otras sesiones abiertas.
router.post('/password', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const { currentPassword, newPassword } = req.body || {};
    const next_ = String(newPassword || '');
    if (next_.length < 6) {
      return res.status(400).json({ error: 'La contraseña nueva tiene que tener al menos 6 caracteres' });
    }
    const found = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = found.rowCount && (await bcrypt.compare(String(currentPassword || ''), found.rows[0].password_hash));
    if (!ok) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    const hash = await bcrypt.hash(next_, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await query('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [req.user.id, readToken(req) || '']);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
