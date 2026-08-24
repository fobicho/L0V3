require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const lettersRouter = require('./routes/letters');
const { authRouter } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.redirect('/admin/login.html'));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cartas-backend' }));
app.get('/api', (req, res) => res.json({
  message: 'API Cartas para mi Novia 💌',
  endpoints: {
    'POST /api/auth/login': 'Login admin {password}',
    'GET /api/auth/me': 'Verificar token',
    'GET /api/letters': 'Listar todas las cartas (público)',
    'GET /api/letters/:id': 'Leer una carta (público)',
    'GET /api/letters/:id/history': 'Ver historial (público)',
    'POST /api/letters': 'Crear carta (admin)',
    'PUT /api/letters/:id': 'Editar carta (admin)',
    'DELETE /api/letters/:id': 'Eliminar carta (admin)'
  }
}));

app.use('/api/auth', authRouter);
app.use('/api/letters', lettersRouter);

app.listen(PORT, () => {
  console.log(`💌 Servidor corriendo en http://localhost:${PORT}`);
});
