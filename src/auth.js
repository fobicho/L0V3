const jwt = require('jsonwebtoken');
const express = require('express');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const USER_SECRET = (process.env.USER_SECRET || '28/05/2024').trim();
const ADMIN_SECRET = (process.env.ADMIN_SECRET || 'Juan Ignacio Castro Cortés').trim();

const authRouter = express.Router();

authRouter.post('/login', (req, res) => {
  const { secret } = req.body;
  if (!secret) {
    return res.status(401).json({ error: 'Ingresa tu código de acceso' });
  }
  const value = secret.trim();
  let role = null;
  if (value === USER_SECRET) role = 'user';
  else if (value === ADMIN_SECRET) role = 'admin';
  if (!role) {
    return res.status(401).json({ error: 'Código incorrecto' });
  }
  const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role, expiresIn: '24h' });
});

authRouter.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    res.json({ role: decoded.role });
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authRouter, requireAuth };
