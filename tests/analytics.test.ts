import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAnalytics,
  acquisition,
  sanitizeURL,
  KEYS,
  type Runtime,
  type Store,
} from "../lib/analytics/core";
import type { Envelope } from "../lib/analytics/types";
function fixture(overrides: Partial<Runtime> = {}) {
  const memory = new Map<string, string>(),
    events: Envelope[] = [],
    logs: Envelope[] = [],
    queue: (() => void)[] = [];
  const store: Store = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => {
      memory.set(k, v);
    },
    removeItem: (k) => {
      memory.delete(k);
    },
  };
  let n = 0;
  const runtime: Runtime = {
    local: store,
    session: store,
    now: () => new Date(2026, 8, 28, 12).getTime(),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    href: () => "https://mindfkd.com/?utm_source=instagram&utm_campaign=launch",
    referrer: () => "https://example.com/private?email=secret",
    hostname: () => "mindfkd.com",
    privacySignal: () => false,
    consent: () => "granted",
    production: true,
    debug: false,
    configured: true,
    defer: (f) => queue.push(f),
    log: (e) => logs.push(e),
    ...overrides,
  };
  const engine = createAnalytics(runtime);
  engine.register({
    name: "capture",
    send: (e) => {
      events.push(e);
    },
  });
  return {
    engine,
    runtime,
    memory,
    events,
    logs,
    flush: () => {
      while (queue.length) queue.shift()!();
    },
  };
}
const start = {
  run_id: "run-1",
  mode: "guest" as const,
  starting_time: 30,
  previous_best_score: 0,
  previous_best_level: 0,
  games_played: 0,
};
const end = {
  run_id: "run-1",
  final_score: 450,
  final_level: 2,
  correct_answers: 1,
  wrong_answers: 0,
  accuracy: 100,
  best_combo: 1,
  questions_attempted: 1,
  run_duration_seconds: 34,
  previous_best_score: 0,
  new_personal_best: true,
  mode: "guest" as const,
};
test("events are deferred; StrictMode visits, run boundaries and retries deduplicate", () => {
  const f = fixture();
  f.engine.visit("/", 0);
  f.engine.visit("/", 0);
  f.engine.begin(start);
  f.engine.begin(start);
  f.engine.complete(end);
  f.engine.complete(end);
  f.engine.begin({ ...start, run_id: "run-2", games_played: 1 });
  assert.equal(f.events.length, 0);
  f.flush();
  assert.deepEqual(
    f.events.map((e) => e.name),
    ["page_view", "game_started", "game_over", "run_replayed", "game_started"],
  );
  assert.equal(new Set(f.events.map((e) => e.player_id)).size, 1);
  assert.equal(new Set(f.events.map((e) => e.session_id)).size, 1);
  assert.equal(f.events.at(-1)?.properties.run_id, "run-2");
});
test("missing configuration, consent, DNT, and localhost prevent production analytics and identifiers", () => {
  for (const overrides of [
    { configured: false },
    { consent: () => "unknown" as const },
    { privacySignal: () => true },
    { hostname: () => "localhost" },
    { production: false },
  ]) {
    const f = fixture(overrides);
    f.engine.begin(start);
    f.flush();
    assert.equal(f.events.length, 0);
    assert.equal(f.memory.size, 0);
  }
  const debug = fixture({
    production: false,
    debug: true,
    hostname: () => "localhost",
  });
  debug.engine.begin(start);
  debug.flush();
  assert.equal(debug.events.length, 0);
  assert.equal(debug.logs.length, 1);
});
test("attribution strips PII-shaped values, query paths, and provider failures are isolated", () => {
  assert.deepEqual(
    acquisition(
      "https://mindfkd.com/?utm_source=instagram&utm_term=person%40mail.com",
      "https://example.com/private?q=secret",
    ),
    { utm_source: "instagram", referrer: "https://example.com" },
  );
  assert.equal(
    sanitizeURL("https://mindfkd.com/profile?u=someone&run=123"),
    "https://mindfkd.com/profile",
  );
  const f = fixture();
  f.engine.register({
    name: "broken",
    send() {
      throw Error("offline");
    },
  });
  f.engine.visit("/", 0);
  assert.doesNotThrow(f.flush);
  assert.equal(f.events.length, 1);
});
test("retention counts distinct calendar days and preserves first touch across sessions", () => {
  const f = fixture();
  f.engine.visit("/", 3);
  f.flush();
  f.runtime.now = () => new Date(2026, 8, 30, 12).getTime();
  f.runtime.href = () => "https://mindfkd.com/?utm_source=tiktok";
  f.engine.visit("/", 3);
  f.flush();
  const returning = f.events.find((e) => e.name === "returning_player")!;
  assert.equal(returning.properties.days_since_last_visit, 2);
  assert.equal(returning.properties.total_visit_days, 2);
  assert.equal(returning.properties.games_played, 3);
  assert.equal(f.events.at(-1)?.firstTouch.utm_source, "instagram");
  assert.equal(f.events.at(-1)?.acquisition.utm_source, "tiktok");
  assert.notEqual(f.events.at(-1)?.session_id, f.events[0].session_id);
  f.engine.reset();
  assert.equal(f.memory.has(KEYS.player), false);
});
test("blocked storage does not interrupt tracking and withdrawal suppresses queued events", () => {
  const broken: Store = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
    removeItem() {
      throw Error();
    },
  };
  const f = fixture({ local: broken, session: broken });
  assert.doesNotThrow(() => f.engine.begin(start));
  f.runtime.consent = () => "denied";
  f.flush();
  assert.equal(f.events.length, 0);
});

test("player identity persists when a fresh page engine is created", () => {
  const f = fixture();
  f.engine.visit("/", 0);
  f.flush();
  const again = createAnalytics(f.runtime);
  again.register({ name: "capture", send: (e) => f.events.push(e) });
  again.visit("/leaderboard", 0);
  f.flush();
  assert.equal(f.events[0].player_id, f.events[1].player_id);
  assert.equal(f.events[0].session_id, f.events[1].session_id);
});

test("unknown properties cannot leak answer text into provider payloads", () => {
  const f = fixture();
  f.engine.track("game_started", {
    ...start,
    is_returning_player: false,
    answer: "private text",
  } as typeof start & { is_returning_player: boolean });
  f.flush();
  assert.equal("answer" in f.events[0].properties, false);
});
