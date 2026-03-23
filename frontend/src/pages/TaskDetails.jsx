import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tasksApi } from '../lib/api.js';

export default function TaskDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [title, setTitle] = useState('');
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage('');
      try {
        const t = await tasksApi.getById(id);
        setTitle(t.title);
        setCompleted(Boolean(t.completed));
      } catch (e) {
        setMessage(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage('');
    try {
      await tasksApi.update(id, { title: trimmed, completed: Boolean(completed) });
      navigate('/');
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    const ok = window.confirm(`Удалить задачу #${id}?`);
    if (!ok) return;

    setLoading(true);
    setMessage('');
    try {
      await tasksApi.remove(id);
      navigate('/');
    } catch (e) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>Детали задачи #{id}</h1>

      <div className="card">
        {loading ? <p>Загрузка...</p> : null}
        {message ? <div className="message">{message}</div> : null}

        <label>
          Название
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
          Завершена
        </label>

        <div className="row">
          <button type="button" onClick={save} disabled={loading}>
            Сохранить
          </button>
          <button type="button" onClick={remove} disabled={loading} className="danger">
            Удалить
          </button>
          <button type="button" onClick={() => navigate('/')} disabled={loading}>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}

