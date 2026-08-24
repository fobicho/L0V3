const express = require('express');
const { randomUUID } = require('crypto');
const { load, save } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', (req, res) => {
  const { letters } = load();
  letters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(letters);
});

router.get('/:id', (req, res) => {
  const { letters } = load();
  const letter = letters.find(l => l.id === req.params.id);
  if (!letter) return res.status(404).json({ error: 'Carta no encontrada' });
  res.json(letter);
});

router.post('/', requireAuth, (req, res) => {
  const { title, content, mood } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title y content son requeridos' });
  const data = load();
  const now = new Date().toISOString();
  const letter = { id: randomUUID(), title, content, mood: mood || null, createdAt: now, updatedAt: now };
  data.letters.push(letter);
  save(data);
  res.status(201).json(letter);
});

router.put('/:id', requireAuth, (req, res) => {
  const data = load();
  const letter = data.letters.find(l => l.id === req.params.id);
  if (!letter) return res.status(404).json({ error: 'Carta no encontrada' });

  const version = data.history.filter(h => h.letterId === letter.id).length + 1;
  data.history.push({ id: randomUUID(), letterId: letter.id, title: letter.title, content: letter.content, mood: letter.mood, version, savedAt: letter.updatedAt });

  const { title, content, mood } = req.body;
  if (title !== undefined) letter.title = title;
  if (content !== undefined) letter.content = content;
  if (mood !== undefined) letter.mood = mood;
  letter.updatedAt = new Date().toISOString();

  save(data);
  res.json(letter);
});

router.delete('/:id', requireAuth, (req, res) => {
  const data = load();
  const idx = data.letters.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Carta no encontrada' });
  data.letters.splice(idx, 1);
  data.history = data.history.filter(h => h.letterId !== req.params.id);
  save(data);
  res.json({ message: 'Carta eliminada' });
});

router.get('/:id/history', (req, res) => {
  const data = load();
  const letter = data.letters.find(l => l.id === req.params.id);
  if (!letter) return res.status(404).json({ error: 'Carta no encontrada' });
  const history = data.history.filter(h => h.letterId === req.params.id).sort((a, b) => b.version - a.version);
  res.json({ current: letter, history });
});

module.exports = router;
