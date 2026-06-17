const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001';

type EnrichHandler = (accountId: string, companyName: string, torpedoData: unknown[]) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<EnrichHandler>();

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

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

  socket.onerror = () => { socket?.close(); };

  socket.onclose = () => {
    socket = null;
    if (handlers.size > 0) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };
}

export function connectWebhookListener(onEnrich: EnrichHandler) {
  handlers.add(onEnrich);
  connect();

  return () => {
    handlers.delete(onEnrich);
  };
}

export function disconnectWebhookListener() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  socket?.close();
  socket = null;
  handlers.clear();
}
