import { api } from "./api";
import type { MatchView } from "./matches";
class TransportError extends Error {}
type Reply = MatchView | { left: true };
export function connectMatch(
  code: string,
  onState: (v: MatchView) => void,
  onStatus: (s: string) => void,
  onLatency: (ms: number) => void,
) {
  let socket: WebSocket | null = null,
    events: EventSource | null = null,
    closed = false,
    lastPacket = 0,
    active = false,
    polling = false,
    lastSync = 0,
    lastPoll = 0;
  let retry: ReturnType<typeof setTimeout> | undefined,
    opening: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<
    string,
    {
      resolve: (value: Reply) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const state = (v: MatchView) => {
    active = v.status === "active";
    onState(v);
  };
  function fallback() {
    if (closed || events) return;
    onStatus("Live · reconnecting");
    events = new EventSource(`/api/matches/stream?code=${code}`);
    events.addEventListener("state", (e) => {
      try {
        lastPacket = performance.now();
        state(JSON.parse((e as MessageEvent).data));
        onStatus("Live · fallback");
      } catch {}
    });
    events.addEventListener("ping", () => {
      lastPacket = performance.now();
    });
  }
  function open() {
    if (closed) return;
    onStatus("Connecting…");
    const url = new URL("/api/matches/socket", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("code", code);
    const ws = new WebSocket(url);
    socket = ws;
    opening = setTimeout(() => {
      fallback();
      if (ws.readyState === WebSocket.CONNECTING) ws.close();
    }, 1500);
    ws.onopen = () => {
      if (closed) {
        ws.close();
        return;
      }
      lastPacket = performance.now();
      clearTimeout(opening);
      events?.close();
      events = null;
      onStatus("Live · WebSocket");
      ws.send(JSON.stringify({ action: "sync", sentAt: performance.now() }));
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        lastPacket = performance.now();
        if (typeof m.sentAt === "number")
          onLatency(Math.max(0, (performance.now() - m.sentAt) / 2));
        if (m.type === "state") state(m.value);
        if (m.requestId) {
          const p = pending.get(m.requestId);
          if (p) {
            pending.delete(m.requestId);
            clearTimeout(p.timer);
            if (m.type === "error") p.reject(new Error(m.error));
            else p.resolve(m.value);
          }
        }
      } catch {}
    };
    ws.onerror = () => {
      fallback();
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      clearTimeout(opening);
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new TransportError("Connection interrupted"));
      }
      pending.clear();
      if (!closed) {
        fallback();
        retry = setTimeout(open, 10000);
      }
    };
  }
  const timer = setInterval(() => {
    if (closed) return;
    const now = performance.now();
    if (socket?.readyState === WebSocket.OPEN) {
      if (now - lastPacket > 5000) {
        socket.close();
        return;
      }
      if (now - lastSync >= (active ? 250 : 1000)) {
        lastSync = now;
        socket.send(JSON.stringify({ action: "sync", sentAt: now }));
      }
    } else if (
      events &&
      now - lastPacket > 3000 &&
      now - lastPoll >= 1500 &&
      !polling
    ) {
      polling = true;
      lastPoll = now;
      onStatus("Reconnecting…");
      void api<MatchView>(`/api/matches/room?code=${code}`)
        .then((v) => {
          if (!closed) {
            lastPacket = performance.now();
            state(v);
          }
        })
        .catch(() => {})
        .finally(() => {
          polling = false;
        });
    }
  }, 125);
  open();
  return {
    async request(
      action: string,
      data: Record<string, unknown>,
    ): Promise<Reply> {
      if (socket?.readyState === WebSocket.OPEN) {
        const requestId = crypto.randomUUID();
        try {
          return await new Promise<Reply>((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.delete(requestId);
              reject(new TransportError("Connection timed out"));
            }, 2500);
            pending.set(requestId, { resolve, reject, timer });
            socket!.send(JSON.stringify({ requestId, action, data }));
          });
        } catch (e) {
          if (!(e instanceof TransportError)) throw e;
        }
      }
      if (closed) throw new TransportError("Connection closed");
      return api<Reply>(`/api/matches/${action}`, { ...data, code });
    },
    close() {
      closed = true;
      clearInterval(timer);
      clearTimeout(retry);
      clearTimeout(opening);
      events?.close();
      socket?.close();
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new TransportError("Connection closed"));
      }
      pending.clear();
    },
  };
}
