const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;
const SERVICE_A_URL = process.env.SERVICE_A_URL || 'http://service-a:3000';

app.use(express.json());

// Базовый healthcheck
app.get('/', (req, res) => {
  res.json({
    message: 'PERN-labs: сервис B запущен',
    serviceAUrl: SERVICE_A_URL,
    time: new Date().toISOString(),
  });
});

// Локальный in-memory CRUD по "notes" — отдельный ресурс
let notes = [
  { id: 1, text: 'Пример заметки', important: false },
];
let nextNoteId = 2;

app.get('/notes', (req, res) => {
  res.json(notes);
});

app.get('/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  return res.json(note);
});

app.post('/notes', (req, res) => {
  const { text, important = false } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'Field "text" is required' });
  }
  const note = { id: nextNoteId += 1, text, important: Boolean(important) };
  notes.push(note);
  return res.status(201).json(note);
});

app.put('/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }
  const { text, important } = req.body || {};
  if (typeof text !== 'string' || typeof important !== 'boolean') {
    return res.status(400).json({ error: 'Fields "text" (string) and "important" (boolean) are required' });
  }
  notes[index] = { id, text, important };
  return res.json(notes[index]);
});

app.delete('/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }
  const [deleted] = notes.splice(index, 1);
  return res.json(deleted);
});

// Взаимодействие: сервис B вызывает сервис A по HTTP
// GET /proxy/tasks — просто проксирует список задач из сервиса A
app.get('/proxy/tasks', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICE_A_URL}/tasks`);
    return res.json({
      source: 'service-a',
      data: response.data,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Failed to fetch tasks from service A',
      details: error.message,
    });
  }
});

// POST /proxy/tasks — создаёт задачу в сервисе A через сервис B
app.post('/proxy/tasks', async (req, res) => {
  try {
    const { title, completed = false } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'Field "title" is required' });
    }

    const response = await axios.post(
      `${SERVICE_A_URL}/tasks`,
      { title, completed },
      { headers: { 'Content-Type': 'application/json' } },
    );

    return res.status(response.status).json({
      source: 'service-a',
      created: response.data,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Failed to create task in service A via service B',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PERN-labs service B is running on port ${PORT}`);
});

