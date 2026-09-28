import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker from "../server/index";
import { hash } from "../server/auth";
import type { Env } from "../server/types";
import { matchClock, matchDuration, type MatchView } from "../lib/matches";
import { buildMatchQuestions } from "../server/matches";
import { GENRES } from "../lib/genres";
test("shared decks and authoritative clock boundaries", () => {
  for (const genre of GENRES) {
    const deck = buildMatchQuestions(genre.id, 123);
    assert.equal(deck.length, 10);
    assert.equal(new Set(deck.map((q) => q.id)).size, 10);
    assert.deepEqual(deck, buildMatchQuestions(genre.id, 123));
  }
  assert.equal(matchClock(1000, 999).phase, "countdown");
  assert.equal(matchClock(1000, 1000).phase, "question");
  assert.equal(matchClock(1000, 11000).phase, "reveal");
  assert.equal(matchClock(1000, 13000).round, 1);
  assert.equal(matchClock(1000, 121000).phase, "finished");
});
test("live matches: unequal teams, locked answers, shared clocks, SSE, privacy and persistent results", async () => {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  function prepare(sql: string) {
    let args: unknown[] = [];
    const p = {
      bind(...v: unknown[]) {
        args = v;
        return p;
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
    return p;
  }
  const env = {
    DB: {
      prepare,
      async batch(statements: { run: () => Promise<unknown> }[]) {
        db.exec("BEGIN");
        try {
          const result = [];
          for (const s of statements) result.push(await s.run());
          db.exec("COMMIT");
          return result;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    ASSETS: { fetch: async () => new Response("asset") },
  } as unknown as Env;
  for (const id of ["one", "two", "three", "outsider"]) {
    db.prepare(
      "INSERT INTO players(id,google_sub,username,display_name,created_at) VALUES(?,?,?,?,?)",
    ).run(id, id, id, id, Date.now());
    db.prepare(
      "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)",
    ).run(await hash(id), id, Date.now() + 3600000);
  }
  async function call(action: string, data?: unknown, user = "one") {
    const r = await worker.fetch(
      new Request(`https://mindfkd.com/api/matches/${action}`, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          cookie: `__Host-mindfkd=${user}`,
          Origin: "https://mindfkd.com",
          "Content-Type": "application/json",
          "x-mindfkd-request": "1",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    return { status: r.status, value: (await r.json()) as MatchView };
  }
  let result = await call("create", { mode: "teams", genre: "sports" });
  assert.equal(result.status, 200);
  const code = result.value.code;
  assert.equal(result.value.question, null);
  assert.equal(result.value.members[0].isMe, true);
  assert.ok(!JSON.stringify(result.value).includes("host_id"));
  assert.ok(!("id" in result.value.members[0]));
  assert.equal((await call("join", { code, team: 1 }, "two")).status, 200);
  assert.equal((await call("join", { code, team: 2 }, "three")).status, 200);
  assert.equal((await call("start", { code })).status, 409);
  assert.equal((await call("start", { code }, "two")).status, 403);
  for (const user of ["one", "two", "three"])
    assert.equal(
      (await call("ready", { code, ready: true }, user)).status,
      200,
    );
  result = await call("start", { code });
  assert.equal(result.status, 200);
  assert.equal(result.value.clock.phase, "countdown");
  assert.equal(
    (await call("answer", { code, round: 0, answer: "fake" })).status,
    409,
  );
  assert.equal((await call("join", { code, team: 2 }, "outsider")).status, 409);
  assert.equal(
    (await call(`room?code=${code}`, undefined, "outsider")).status,
    403,
  );
  assert.equal((await call("leave", { code }, "two")).status, 409);
  const start = Date.now() - 500;
  db.prepare("UPDATE matches SET start_at=?,end_at=? WHERE code=?").run(
    start,
    start + matchDuration,
    code,
  );
  const a = (await call(`room?code=${code}`)).value,
    b = (await call(`room?code=${code}`, undefined, "two")).value;
  assert.deepEqual(a.question, b.question);
  assert.equal(a.clock.deadline, b.clock.deadline);
  assert.equal(a.question?.answer, "");
  assert.equal(a.question?.explanation, undefined);
  const deck = JSON.parse(
    (
      db.prepare("SELECT questions FROM matches WHERE code=?").get(code) as {
        questions: string;
      }
    ).questions,
  );
  assert.equal(
    (await call("answer", { code, round: 1, answer: deck[0].answer })).status,
    409,
  );
  const correct = deck[0].answer,
    wrong = deck[0].options.find((v: string) => v !== correct);
  result = await call("answer", { code, round: 0, answer: correct });
  assert.equal(result.value.answered, true);
  assert.equal(result.value.correct, null);
  assert.equal(result.value.members[0].score, 0);
  await call("answer", { code, round: 0, answer: wrong });
  assert.equal(
    (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM match_answers WHERE code=? AND player_id=?",
        )
        .get(code, "one") as { n: number }
    ).n,
    1,
  );
  await call("answer", { code, round: 0, answer: correct }, "two");
  await call("answer", { code, round: 0, answer: wrong }, "three");
  const stream = await worker.fetch(
    new Request(`https://mindfkd.com/api/matches/stream?code=${code}`, {
      headers: { cookie: "__Host-mindfkd=two" },
    }),
    env,
  );
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("Content-Type")!, /event-stream/);
  const reader = stream.body!.getReader();
  let text = "";
  for (let i = 0; i < 4 && !text.includes("event: state"); i++)
    text += new TextDecoder().decode((await reader.read()).value);
  assert.match(text, /event: state/);
  assert.ok(!text.includes("host_id"));
  await reader.cancel();
  db.prepare("UPDATE matches SET start_at=?,end_at=? WHERE code=?").run(
    Date.now() - 10500,
    Date.now() + 109500,
    code,
  );
  result = await call(`room?code=${code}`);
  assert.equal(result.value.clock.phase, "reveal");
  assert.equal(result.value.teams[0].total, 200 * deck[0].difficulty);
  assert.equal(result.value.teams[1].total, 0);
  assert.equal(
    result.value.members.find((m) => m.username === "three")?.wrong,
    1,
  );
  assert.equal(
    result.value.members.find((m) => m.username === "one")?.correct,
    1,
  );
  assert.equal(
    (await call("answer", { code, round: 0, answer: correct })).status,
    409,
  );
  db.prepare("UPDATE matches SET start_at=?,end_at=? WHERE code=?").run(
    Date.now() - matchDuration - 10,
    Date.now() - 10,
    code,
  );
  result = await call(`room?code=${code}`);
  assert.equal(result.value.status, "finished");
  assert.equal(result.value.winnerTeam, 1);
  assert.equal(result.value.members[0].unanswered, 9);
  async function profile(user: string) {
    const r = await worker.fetch(
      new Request(`https://mindfkd.com/api/player?u=${user}`),
      env,
    );
    return (await r.json()) as {
      competition: { wins: number; losses: number; teamWins: number };
    };
  }
  assert.equal((await profile("one")).competition.teamWins, 1);
  assert.equal((await profile("one")).competition.teamWins, 1);
  const duel = (await call("create", { mode: "duel", genre: "history" })).value
    .code;
  assert.equal(
    (await call("join", { code: duel, team: 1 }, "two")).status,
    409,
  );
  await call("join", { code: duel, team: 2 }, "two");
  for (const user of ["one", "two"])
    await call("ready", { code: duel, ready: true }, user);
  await call("start", { code: duel });
  db.prepare(
    "INSERT INTO match_answers(code,player_id,round,answer,correct,score,answered_at) VALUES(?,'two',0,'\"answer\"',1,100,?)",
  ).run(duel, Date.now());
  db.prepare("UPDATE matches SET start_at=?,end_at=? WHERE code=?").run(
    Date.now() - matchDuration - 10,
    Date.now() - 10,
    duel,
  );
  assert.equal((await profile("two")).competition.wins, 1);
  assert.equal((await profile("one")).competition.losses, 1);
  assert.equal((await profile("two")).competition.wins, 1);
  db.close();
});
