/**
 * Connects to the SignalIQ backend WebSocket.
 * When Clay sends torpedo JSON to /api/enrich, the backend pushes it here.
 */

const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001';

type EnrichHandler = (accountId: string, companyName: string, torpedoData: unknown[]) => void;

let socket: WebSocket | null = null;
const handlers = new Set<EnrichHandler>();

export function connectWebhookListener(onEnrich: EnrichHandler) {
  handlers.add(onEnrich);

  if (socket && socket.readyState === WebSocket.OPEN) return;

  socket = new WebSocket(WS_URL);

  socket.onmessage = (event) => {
    try {
      const { event: name, data } = JSON.parse(event.data);
      if (name === 'enrich') {
        for (const h of handlers) {
          h(data.account_id, data.company_name, data.data);
        }
      }
    } catch {}
  };

  socket.onclose = () => {
    socket = null;
    // Reconnect after 3s
    setTimeout(() => {
      if (handlers.size > 0) connectWebhookListener(() => {});
    }, 3000);
  };

  return () => {
    handlers.delete(onEnrich);
  };
}

export function disconnectWebhookListener() {
  socket?.close();
  socket = null;
  handlers.clear();
}
