const http = require('http');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Рассылаем событие всем подключённым WS-клиентам
function broadcast(event, payload) {
  const msg = JSON.stringify({ event, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  console.log('WS client connected, total:', wss.clients.size);
  ws.on('close', () => console.log('WS client disconnected, total:', wss.clients.size));
});

// Для фронтенда (ui на :5173) разрешаем CORS
app.use(
  cors({
    origin: '*',
  }),
);

app.use(express.json());

if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

app.get('/', (req, res) => {
  res.json({
    message: 'PERN-labs: сервис A запущен',
    time: new Date().toISOString(),
  });
});

app.get('/info', (req, res) => {
  res.json({
    project: 'PERN-labs',
    service: 'A',
    topic: 'Контейнеризация, Docker, REST, CRUD',
    author: 'Golban Vladislav',
  });
});

async function initDb() {
  // Создаём таблицу при старте сервиса (для лабораторной удобнее, чем отдельные миграции)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const reset = process.env.RESET_TASKS_ON_STARTUP === 'true';
  if (reset) {
    // Для удобства демонстраций в лабораторных проще предсказуемые ID
    await pool.query('TRUNCATE TABLE tasks RESTART IDENTITY;');
    await pool.query('INSERT INTO tasks(title, completed) VALUES ($1, $2)', [
      'Пример задания',
      false,
    ]);
  }
}

// GET /tasks — получить все задачи
app.get('/tasks', async (req, res) => {
  const { rows } = await pool.query('SELECT id, title, completed FROM tasks ORDER BY id');
  return res.json(rows);
});

// GET /tasks/:id — получить одну задачу
app.get('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT id, title, completed FROM tasks WHERE id = $1', [id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json(task);
});

// POST /tasks — создать задачу
app.post('/tasks', async (req, res) => {
  const { title, completed = false } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'Field "title" is required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tasks(title, completed) VALUES($1, $2) RETURNING id, title, completed',
    [title, Boolean(completed)],
  );
  broadcast('task:created', rows[0]);
  return res.status(201).json(rows[0]);
});

// PUT /tasks/:id — полное обновление
app.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { title, completed } = req.body || {};
  if (typeof title !== 'string' || typeof completed !== 'boolean') {
    return res
      .status(400)
      .json({ error: 'Fields "title" (string) and "completed" (boolean) are required' });
  }

  const { rows } = await pool.query(
    'UPDATE tasks SET title = $1, completed = $2 WHERE id = $3 RETURNING id, title, completed',
    [title, completed, id],
  );
  const updated = rows[0];
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  broadcast('task:updated', updated);
  return res.json(updated);
});

// DELETE /tasks/:id — удалить задачу
app.delete('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id, title, completed', [id]);
  const deleted = rows[0];
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  broadcast('task:deleted', deleted);
  return res.json(deleted);
});

async function start() {
  // Postgres в docker-compose может быть ещё "в процессе" готовности.
  const maxAttempts = 15;
  const delayMs = 2000;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await initDb();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      // eslint-disable-next-line no-console
      console.error(`DB init failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (lastErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to init database after retries', lastErr);
    process.exit(1);
  }

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PERN-labs service A is running on port ${PORT} (HTTP + WebSocket)`);
  });
}

start();

