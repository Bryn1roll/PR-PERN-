import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emailApi, tasksApi } from '../lib/api.js';

export default function TasksList() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [emailTo, setEmailTo] = useState('to@localhost');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [imapCount, setImapCount] = useState(null);
  const [pop3Count, setPop3Count] = useState(null);

  async function loadTasks() {
    setLoading(true);
    setMessage('');
    try {
      const data = await tasksApi.list();
      setTasks(data);
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function addTask(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setLoading(true);
    setMessage('');
    try {
      await tasksApi.create({ title, completed: false });
      setNewTitle('');
      await loadTasks();
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(id) {
    const ok = window.confirm(`Удалить задачу #${id}?`);
    if (!ok) return;

    setLoading(true);
    setMessage('');
    try {
      await tasksApi.remove(id);
      await loadTasks();
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail(taskId) {
    setMessage('');
    setImapCount(null);
    setPop3Count(null);
    setLoading(true);
    try {
      await emailApi.send({ taskId, to: emailTo });

      // Для демонстрации ЛР4 сразу проверяем входящую почту по IMAP/POP3
      const imap = await emailApi.checkImap();
      const pop3 = await emailApi.checkPop3();
      setImapCount(imap.count);
      setPop3Count(pop3.count);
      setMessage('Письмо отправлено. Почта проверена через IMAP/POP3.');
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>ToDo List (PERN-labs)</h1>

      <div className="grid">
        <form className="card" onSubmit={addTask}>
          <h2>Добавить задачу</h2>
          <label>
            Название
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например: сделать отчет"
            />
          </label>
          <button type="submit" disabled={loading}>
            Добавить
          </button>
        </form>

        <div className="card">
          <h2>Отправка по e-mail</h2>
          <label>
            Получатель
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
          </label>
          <p className="hint">На стенде используется GreenMail, например: <code>to@localhost</code>.</p>
        </div>
      </div>

      {message ? <div className="message">{message}</div> : null}

      {imapCount !== null || pop3Count !== null ? (
        <div className="message">
          IMAP INBOX: {imapCount ?? '—'}; POP3 inbox: {pop3Count ?? '—'}
        </div>
      ) : null}

      <div className="card">
        <h2>Задачи</h2>
        {loading ? <p>Загрузка...</p> : null}

        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Готово</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.title}</td>
                <td>{t.completed ? 'да' : 'нет'}</td>
                <td className="actions">
                  <button type="button" onClick={() => navigate(`/tasks/${t.id}`)} disabled={loading}>
                    Детали/редактировать
                  </button>
                  <button type="button" onClick={() => deleteTask(t.id)} disabled={loading}>
                    Удалить
                  </button>
                  <button type="button" onClick={() => sendEmail(t.id)} disabled={loading}>
                    Отправить e-mail
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="4">Нет задач</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

