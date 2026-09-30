import type { Snapshot, Challenge } from "../components/SequenceGame";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { challengeAPI } from "../server/challenges";
import { makeSequence, startSequence, advanceSequence } from "../lib/sequence";
import { questions } from "../data/questions";
import { answerRanked, publicRun } from "../server/ranked";
import { hash } from "../server/auth";
import type { Env } from "../server/types";
import worker from "../server/index";
test("fixed sequences preserve answer order, scoring, escalation and time limits", () => {
  const deck = makeSequence(questions, 27);
  assert.deepEqual(deck, makeSequence(questions, 27));
  assert.notDeepEqual(deck, makeSequence(questions, 28));
  assert.equal(new Set(deck.map((q) => q.topicKey ?? q.id)).size, 50);
  const a = startSequence(deck, 1000),
    b = startSequence(deck, 5000);
  assert.deepEqual(a.run.question, b.run.question);
  const answered = answerRanked(a, deck[0].answer, 1500);
  assert.equal(advanceSequence(answered, deck, 1600), answered);
  const next = advanceSequence(answered, deck, 2200);
  assert.deepEqual(next.run.question, deck[1]);
  assert.equal(publicRun(next, 2200, "id", 1).run.question?.answer, "");
  assert.equal(advanceSequence(next, deck, 100000).run.phase, "gameOver");
});
test("SQL Daily and guest friend challenges: immutable decks, one attempt, privacy, replay and midnight", async () => {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("drizzle/" + f, "utf8"));
  const env = {
    DB: {
      async batch(statements: { run: () => Promise<unknown> }[]) {
        db.exec("BEGIN");
        try {
          const r = [];
          for (const stmt of statements) r.push(await stmt.run());
          db.exec("COMMIT");
          return r;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      prepare(sql: string) {
        let args: unknown[] = [];
        const stmt = {
          bind(...a: unknown[]) {
            args = a;
            return stmt;
          },
          async first() {
            return db.prepare(sql).get(...(args as [])) ?? null;
          },
          async all() {
            return { results: db.prepare(sql).all(...(args as [])) };
          },
          async run() {
            return {
              meta: {
                changes: Number(db.prepare(sql).run(...(args as [])).changes),
              },
            };
          },
        };
        return stmt;
      },
    },
    ASSETS: {
      async fetch() {
        return new Response("asset");
      },
    },
  } as unknown as Env;
  const now = Date.UTC(2026, 8, 30, 12);
  db.prepare(
    "INSERT INTO players(id,google_sub,display_name,username,created_at) VALUES('p','s','Test','tester',?)",
  ).run(now);
  db.prepare(
    "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)",
  ).run(await hash("session"), "p", now + 86400000 * 3);
  async function call(
    action: string,
    body?: Record<string, unknown>,
    cookie = "",
    at = now,
  ) {
    const req = new Request("https://mindfkd.com/api/challenges/" + action, {
      method: body ? "POST" : "GET",
      headers: { cookie },
    });
    const res = await challengeAPI(req, env, body ?? {}, at);
    return {
      data: (await res.json()) as Snapshot & Challenge,
      cookie: res.headers.get("set-cookie")?.split(";")[0] ?? cookie,
    };
  }
  const daily = (await call("daily")).data;
  assert.equal(daily.number, 1);
  assert.equal(daily.attempt, null);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM challenge_sets").get()!.n,
    2,
    "tomorrow prepared before midnight",
  );
  const before = db
    .prepare("SELECT deck FROM challenge_sets WHERE id=?")
    .get(daily.id)!.deck;
  await call("daily");
  assert.equal(
    db.prepare("SELECT deck FROM challenge_sets WHERE id=?").get(daily.id)!
      .deck,
    before,
  );
  await assert.rejects(call("start", { setId: daily.id }), /Sign in/);
  const user = "__Host-mindfkd=session";
  const s = (await call("start", { setId: daily.id }, user)).data;
  assert.equal(s.run.question!.answer, "");
  const again = (await call("start", { setId: daily.id }, user)).data;
  assert.equal(again.id, s.id);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM player_question_seen WHERE player_id='p'",
      )
      .get()!.n,
    1,
  );
  const finished = (
    await call("finish", { id: s.id, version: s.version }, user, now + 31000)
  ).data;
  assert.equal(finished.run.phase, "gameOver");
  assert.equal(finished.result!.score, 0);
  assert.equal(
    (await call("start", { setId: daily.id }, user, now + 32000)).data.id,
    s.id,
  );
  assert.equal(
    (await call("daily", undefined, user)).data.leaderboard.length,
    1,
  );
  const tomorrow = (await call("daily", undefined, user, now + 86400000)).data;
  assert.notEqual(tomorrow.id, daily.id);
  await assert.rejects(call("set?id=daily-2026-10-01"), /not found/);
  const requestId = crypto.randomUUID();
  const creator = await call("create", { requestId });
  assert.equal(
    (await call("create", { requestId }, creator.cookie)).data.id,
    creator.data.id,
  );
  await assert.rejects(call("create", { requestId }, user), /already used/);
  const id = creator.data.id;
  assert.ok(creator.cookie.includes("__Host-mindfkd-challenge="));
  assert.ok(!JSON.stringify(creator.data).includes("creator_actor"));
  await assert.rejects(call("start", { setId: id }), /still setting/);
  const a = (await call("start", { setId: id }, creator.cookie)).data;
  const deck = JSON.parse(
    db.prepare("SELECT deck FROM challenge_sets WHERE id=?").get(id)!
      .deck as string,
  );
  const answer = (
    await call(
      "answer",
      { id: a.id, version: 0, answer: deck[0].answer },
      creator.cookie,
      now + 1000,
    )
  ).data;
  const replay = (
    await call(
      "answer",
      { id: a.id, version: 0, answer: deck[0].answer },
      creator.cookie,
      now + 1001,
    )
  ).data;
  assert.equal(replay.version, answer.version);
  assert.equal(replay.run.score, answer.run.score);
  await assert.rejects(
    call("finish", { id: a.id, version: answer.version }, user, now + 100000),
    /not found/,
  );
  await call(
    "finish",
    { id: a.id, version: answer.version },
    creator.cookie,
    now + 100000,
  );
  const opponent = await call("start", { setId: id }, "", now + 101000);
  assert.deepEqual(
    opponent.data.run.question!.options,
    a.run.question!.options,
  );
  assert.equal(opponent.data.run.question!.id, a.run.question!.id);
  const landing = (await call("set?id=" + id, undefined, opponent.cookie)).data;
  assert.equal(landing.creatorResult!.score, answer.run.score);
  assert.equal(landing.ready, true);
  await call(
    "finish",
    { id: opponent.data.id, version: 0 },
    opponent.cookie,
    now + 140000,
  );
  const rematch = (
    await call("create", { parentId: id }, opponent.cookie, now + 141000)
  ).data;
  assert.equal(
    (await call("set?id=" + id, undefined, creator.cookie)).data.opponents
      .length,
    1,
  );
  assert.equal(rematch.parentId, id);
  assert.notEqual(rematch.id, id);
  const csrf = await worker.fetch(
    new Request("https://mindfkd.com/api/challenges/create", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
        "x-mindfkd-request": "1",
      },
      body: "{}",
    }),
    env,
  );
  assert.equal(csrf.status, 403);
  db.close();
});
