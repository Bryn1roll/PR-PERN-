const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

// In-memory CRUD по ресурсу "tasks" — потом можно заменить на БД
let tasks = [
  { id: 1, title: 'Пример задания', completed: false },
];
let nextId = 2;

// GET /tasks — получить все задачи
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

// GET /tasks/:id — получить одну задачу
app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  return res.json(task);
});

// POST /tasks — создать задачу
app.post('/tasks', (req, res) => {
  const { title, completed = false } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'Field "title" is required' });
  }
  const task = { id: nextId += 1, title, completed: Boolean(completed) };
  tasks.push(task);
  return res.status(201).json(task);
});

// PUT /tasks/:id — полное обновление
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, completed } = req.body || {};
  if (typeof title !== 'string' || typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'Fields "title" (string) and "completed" (boolean) are required' });
  }

  tasks[index] = { id, title, completed };
  return res.json(tasks[index]);
});

// DELETE /tasks/:id — удалить задачу
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const [deleted] = tasks.splice(index, 1);
  return res.json(deleted);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PERN-labs service A is running on port ${PORT}`);
});

