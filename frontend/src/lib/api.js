const SERVICE_A_BASE = import.meta.env.VITE_SERVICE_A_BASE || 'http://localhost:3000';
const SERVICE_B_BASE = import.meta.env.VITE_SERVICE_B_BASE || 'http://localhost:4000';

export async function apiFetch(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Request failed: ${resp.status} ${resp.statusText}. ${text}`.trim());
  }
  return resp.json();
}

export function getServiceABase() {
  return SERVICE_A_BASE;
}

export function getServiceBBase() {
  return SERVICE_B_BASE;
}

// Tasks (service A)
export const tasksApi = {
  list: () => apiFetch(`${SERVICE_A_BASE}/tasks`),
  getById: (id) => apiFetch(`${SERVICE_A_BASE}/tasks/${id}`),
  create: (payload) =>
    apiFetch(`${SERVICE_A_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    apiFetch(`${SERVICE_A_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  remove: (id) => apiFetch(`${SERVICE_A_BASE}/tasks/${id}`, { method: 'DELETE' }),
};

// Email (service B)
export const emailApi = {
  send: (payload) =>
    apiFetch(`${SERVICE_B_BASE}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  checkImap: () => apiFetch(`${SERVICE_B_BASE}/email/check-imap`),
  checkPop3: () => apiFetch(`${SERVICE_B_BASE}/email/check-pop3`),
};

