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

// Soporte: restablece la contraseña de otro usuario (por ejemplo, si el comercio la olvidó).
router.get('/users', async (req, res, next) => {
  try {
    if (req.user?.role !== 'support') return res.status(403).json({ error: 'Solo para soporte' });
    const result = await query('SELECT id, username, name, role FROM users ORDER BY id');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/password', async (req, res, next) => {
  try {
    if (req.user?.role !== 'support') return res.status(403).json({ error: 'Solo para soporte' });
    const password = String(req.body?.newPassword || '');
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña nueva tiene que tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    await query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
