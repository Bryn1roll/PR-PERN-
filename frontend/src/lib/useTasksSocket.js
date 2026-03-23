import { useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_SERVICE_A_WS || 'ws://localhost:3000';

/**
 * Подключается к WebSocket сервиса A и вызывает onMessage при каждом событии.
 * события: { event: 'task:created' | 'task:updated' | 'task:deleted', payload: task }
 */
export function useTasksSocket(onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let destroyed = false;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => console.log('[WS] connected');

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessageRef.current(data);
        } catch {
          // игнорируем невалидные сообщения
        }
      };

      ws.onclose = () => {
        console.log('[WS] disconnected, reconnect in 3s...');
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
