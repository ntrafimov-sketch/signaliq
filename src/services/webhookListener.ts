const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001';

type EnrichHandler = (accountId: string, companyName: string, torpedoData: unknown[]) => void;
type SequenceHandler = (accountId: string, personId: string, result: unknown) => void;
type StatusHandler = (status: 'connecting' | 'connected' | 'disconnected', lastMsg?: string) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<EnrichHandler>();
const sequenceHandlers = new Set<SequenceHandler>();
const statusHandlers = new Set<StatusHandler>();

function notifyStatus(status: 'connecting' | 'connected' | 'disconnected', lastMsg?: string) {
  for (const h of statusHandlers) h(status, lastMsg);
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  notifyStatus('connecting');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    notifyStatus('connected');
  };

  socket.onmessage = (event) => {
    try {
      const { event: name, data } = JSON.parse(event.data);
      console.log('[WS] message:', name, data);
      if (name === 'enrich') {
        notifyStatus('connected', `Got: ${data.company_name} @ ${new Date().toLocaleTimeString()}`);
        for (const h of handlers) {
          h(data.account_id, data.company_name, data.data);
        }
      } else if (name === 'sequence') {
        for (const h of sequenceHandlers) {
          h(data.account_id, data.person_id, data.result);
        }
      }
    } catch (e) {
      console.error('[WS] parse error', e);
    }
  };

  socket.onerror = (e) => {
    console.error('[WS] error', e);
    socket?.close();
  };

  socket.onclose = () => {
    socket = null;
    notifyStatus('disconnected');
    if (handlers.size > 0 || sequenceHandlers.size > 0) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };
}

export function subscribeSequenceResult(onSequence: SequenceHandler) {
  sequenceHandlers.add(onSequence);
  connect();
  return () => { sequenceHandlers.delete(onSequence); };
}

export function connectWebhookListener(onEnrich: EnrichHandler) {
  handlers.add(onEnrich);
  connect();

  return () => {
    handlers.delete(onEnrich);
  };
}

export function subscribeWsStatus(onStatus: StatusHandler) {
  statusHandlers.add(onStatus);
  // emit current state immediately
  const state = !socket ? 'disconnected'
    : socket.readyState === WebSocket.OPEN ? 'connected' : 'connecting';
  onStatus(state);
  return () => { statusHandlers.delete(onStatus); };
}

export function getWsUrl() { return WS_URL; }

export function disconnectWebhookListener() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  socket?.close();
  socket = null;
  handlers.clear();
}
