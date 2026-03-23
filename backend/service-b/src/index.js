const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const Pop3Command = require('node-pop3');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const SERVICE_A_URL = process.env.SERVICE_A_URL || 'http://service-a:3000';

const MAIL_HOST = process.env.MAIL_HOST;
const MAIL_SMTP_PORT = Number(process.env.MAIL_SMTP_PORT || 3025);
const MAIL_IMAP_PORT = Number(process.env.MAIL_IMAP_PORT || 3143);
const MAIL_POP3_PORT = Number(process.env.MAIL_POP3_PORT || 3110);
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_FROM = process.env.MAIL_FROM;
const MAIL_SMTP_AUTH = process.env.MAIL_SMTP_AUTH === 'true';

app.use(express.json());

// Для фронтенда (ui на :5173) разрешаем CORS
app.use(
  cors({
    origin: '*',
  }),
);

function requireMailConfig() {
  const missing = [];
  if (!MAIL_HOST) missing.push('MAIL_HOST');
  if (!MAIL_USER) missing.push('MAIL_USER');
  if (!MAIL_PASS) missing.push('MAIL_PASS');
  if (!MAIL_FROM) missing.push('MAIL_FROM');
  if (missing.length) {
    throw new Error(`Missing mail config env vars: ${missing.join(', ')}`);
  }
}

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

// ЛР4: отправка письма через SMTP (GreenMail в Docker)
app.post('/email/send', async (req, res) => {
  try {
    requireMailConfig();
    const { taskId, to } = req.body || {};
    if (!taskId) return res.status(400).json({ error: 'Field "taskId" is required' });
    if (!to) return res.status(400).json({ error: 'Field "to" (recipient email) is required' });

    const taskResp = await axios.get(`${SERVICE_A_URL}/tasks/${taskId}`);
    const task = taskResp.data;

    const transporter = nodemailer.createTransport({
      host: MAIL_HOST,
      port: MAIL_SMTP_PORT,
      secure: false, // для test-ports GreenMail (3025) обычно не требуется TLS
      // GreenMail в docker-compose у нас с auth.disabled, поэтому по умолчанию
      // авторизацию на SMTP не используем (иначе можно получить 451).
      auth: MAIL_SMTP_AUTH
        ? {
            user: MAIL_USER,
            pass: MAIL_PASS,
          }
        : undefined,
    });

    const subject = `Task #${task.id}: ${task.title}`;
    const text = `Task details:\n\nTitle: ${task.title}\nCompleted: ${task.completed}\nID: ${task.id}\n`;

    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
    });

    return res.json({
      sent: true,
      messageId: info.messageId,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Failed to send email',
      details: error.message,
    });
  }
});

// ЛР4: проверка входящей почты через IMAP
app.get('/email/check-imap', async (req, res) => {
  try {
    requireMailConfig();

    const client = new ImapFlow({
      host: MAIL_HOST,
      port: MAIL_IMAP_PORT,
      secure: false,
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASS,
      },
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ all: true }, { uid: true });
      return res.json({ mailbox: 'INBOX', count: uids.length });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to check IMAP',
      details: error.message,
    });
  }
});

// ЛР4: проверка входящей почты через POP3
app.get('/email/check-pop3', async (req, res) => {
  try {
    requireMailConfig();

    const pop3 = new Pop3Command({
      user: MAIL_USER,
      password: MAIL_PASS,
      host: MAIL_HOST,
      port: MAIL_POP3_PORT,
      tls: false,
    });

    await pop3.connect();
    // В некоторых реализациях POP3 логин/пароль нужно отправлять командами.
    await pop3.command('USER', MAIL_USER);
    await pop3.command('PASS', MAIL_PASS);

    const [statInfo] = await pop3.command('STAT');
    const count = Number(String(statInfo).split(' ')[0]);

    await pop3.QUIT();
    return res.json({ mailbox: 'inbox', count });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to check POP3',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PERN-labs service B is running on port ${PORT}`);
});

