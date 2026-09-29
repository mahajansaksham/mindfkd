import type { Env, Player } from "./types";
import { currentPlayer } from "./auth";
import {
  matchAPI,
  matchView,
  readRoom,
  settle,
  MatchError,
  type Room,
} from "./matches";
import { matchClock } from "../lib/matches";

declare const WebSocketPair: new () => {
  0: WebSocket;
  1: WebSocket & { accept(): void };
};
// Each connection caches only a projection. D1 revisions, never isolate memory,
// decide whether state is current across different Workers and regions.
export function roomReader(env: Env, code: string, playerId: string) {
  let cached: Room | null = null,
    phase = "";
  return async (force = false) => {
    const head = await env.DB.prepare(
      "SELECT revision,status,start_at,end_at,created_at FROM matches WHERE code=?",
    )
      .bind(code)
      .first<
        Pick<Room, "revision" | "status" | "start_at" | "end_at" | "created_at">
      >();
    if (!head) throw new MatchError(404, "Room not found");
    const now = Date.now(),
      clock = matchClock(head.start_at, now),
      nextPhase = `${clock.phase}:${clock.round}`;
    const expire =
      (head.status === "active" &&
        head.end_at !== null &&
        head.end_at <= now) ||
      (head.status === "waiting" && now - head.created_at > 1800000);
    if (
      !force &&
      cached &&
      head.revision === cached.revision &&
      nextPhase === phase &&
      !expire
    )
      return null;
    cached = await settle(env, await readRoom(env, code), now);
    phase = nextPhase;
    return matchView(cached, playerId, Date.now());
  };
}
export async function matchSocket(request: Request, env: Env, player: Player) {
  if (!player.username)
    throw new MatchError(409, "Create your profile to compete");
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase();
  if (!code || !/^[A-F0-9]{12}$/.test(code))
    throw new MatchError(400, "Enter a valid room code");
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
    throw new MatchError(426, "WebSocket upgrade required");
  if (typeof WebSocketPair === "undefined")
    throw new MatchError(503, "WebSocket transport unavailable");
  const read = roomReader(env, code, player.id),
    initial = await read(true);
  const { 0: client, 1: socket } = new WebSocketPair();
  socket.accept();
  let queued = 0;
  let chain = Promise.resolve();
  let closed = false,
    lastAuth = Date.now(),
    lastSync = 0,
    windowStart = Date.now(),
    messages = 0;
  const began = Date.now();
  const send = (value: unknown) => {
    if (!closed) socket.send(JSON.stringify(value));
  };
  socket.addEventListener("close", () => {
    closed = true;
  });
  socket.addEventListener("error", () => {
    closed = true;
  });
  socket.addEventListener("message", (event) => {
    void (async () => {
      let requestId: string | undefined;
      try {
        if (
          typeof event.data !== "string" ||
          event.data.length > 4096 ||
          new TextEncoder().encode(event.data).length > 4096
        ) {
          socket.close(1009, "Message too large");
          return;
        }
        const now = Date.now();
        if (now - windowStart >= 1000) {
          messages = 0;
          windowStart = now;
        }
        if (++messages > 20) {
          socket.close(1008, "Too many messages");
          return;
        }
        const value = JSON.parse(event.data);
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new MatchError(400, "Invalid message");
        requestId =
          typeof value.requestId === "string" &&
          /^[a-zA-Z0-9-]{1,64}$/.test(value.requestId)
            ? value.requestId
            : undefined;
        if (queued >= 4) {
          if (requestId)
            send({
              type: "error",
              requestId,
              error: "Too many pending actions. Retry shortly.",
            });
          return;
        }
        if (value.action === "sync" && (queued > 0 || now - lastSync < 200))
          return;
        queued++;
        const previous = chain;
        let release!: () => void;
        chain = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          if (closed) return;
          if (now - began > 600000) {
            socket.close(1000, "Reconnect");
            return;
          }
          if (now - lastAuth > 5000 || value.action !== "sync") {
            const p = await currentPlayer(request, env);
            if (!p || p.id !== player.id) {
              socket.close(1008, "Sign in again");
              return;
            }
            lastAuth = now;
          }
          if (value.action === "sync") {
            lastSync = now;
            const state = await read();
            send(
              state
                ? { type: "state", value: state, sentAt: value.sentAt }
                : { type: "pong", sentAt: value.sentAt },
            );
          } else {
            if (
              !requestId ||
              !["answer", "join", "ready", "start", "leave", "name"].includes(
                value.action,
              )
            )
              throw new MatchError(400, "Invalid match action");
            const data = value.data;
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw new MatchError(400, "Invalid match input");
            const next = new URL(request.url);
            next.pathname = `/api/matches/${value.action}`;
            next.search = "";
            const response = await matchAPI(
              new Request(next, { method: "POST", headers: request.headers }),
              env,
              player,
              { ...data, code },
            );
            const result = await response.json();
            send({ type: "reply", requestId, value: result });
          }
        } finally {
          queued--;
          release();
        }
      } catch (error) {
        send({
          type: "error",
          requestId,
          error:
            error instanceof MatchError
              ? error.message
              : "Could not update the match. Please retry.",
        });
      }
    })();
  });
  send({ type: "state", value: initial });
  // Keep the upgrade response intact; cloning it loses the socket.
  return new Response(null, { status: 101, webSocket: client } as ResponseInit);
}
