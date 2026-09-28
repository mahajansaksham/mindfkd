import type { Run } from "../lib/game";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../server/index";
import { hash } from "../server/auth";
import {
  newRanked,
  answerRanked,
  advanceRanked,
  publicRun,
} from "../server/ranked";
import type { Env } from "../server/types";
import { shareText } from "../lib/share";
test("ranked state hides answers, enforces feedback, timer and one submission", () => {
  const s = newRanked(4, 1000);
  assert.equal(publicRun(s, 1000, "run", 0).run.question?.answer, "");
  const a = answerRanked(s, s.run.question!.answer, 2000);
  assert.equal(a.run.deadline, 35000);
  assert.equal(answerRanked(a, s.run.question!.answer, 2001), a);
  assert.equal(advanceRanked(a, 2001), a);
  const n = advanceRanked(a, 2600);
  assert.notEqual(n.run.question?.id, s.run.question?.id);
  assert.equal(publicRun(n, 2600, "run", 1).run.question?.answer, "");
  assert.equal(advanceRanked(n, 100000).run.phase, "gameOver");
  assert.match(
    shareText(a.run, "friend", "run-1"),
    /https:\/\/mindfkd.com\/profile\?u=friend&run=run-1/,
  );
});
test("real SQLite persistence: auth, profiles, follows, ranked scores and idempotence", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("drizzle/0000_happy_imperial_guard.sql", "utf8"));
  function prepare(sql: string) {
    let args: unknown[] = [];
    const obj = {
      bind(...v: unknown[]) {
        args = v;
        return obj;
      },
      async first() {
        return sqlite.prepare(sql).get(...(args as [])) ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...(args as [])) };
      },
      async run() {
        const r = sqlite.prepare(sql).run(...(args as []));
        return { meta: { changes: Number(r.changes) } };
      },
    };
    return obj;
  }
  const env = {
    DB: {
      prepare,
      async batch(statements: { run: () => Promise<unknown> }[]) {
        sqlite.exec("BEGIN");
        try {
          const values = [];
          for (const s of statements) values.push(await s.run());
          sqlite.exec("COMMIT");
          return values;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
    },
    ASSETS: { fetch: async () => new Response("asset") },
  } as unknown as Env;
  for (const id of ["one", "two"]) {
    sqlite
      .prepare(
        "INSERT INTO players(id,google_sub,display_name,created_at) VALUES(?,?,?,?)",
      )
      .run(id, id, id, Date.now());
    sqlite
      .prepare(
        "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)",
      )
      .run(await hash(id), id, Date.now() + 3600000);
  }
  async function request(
    path: string,
    data?: unknown,
    user = "one",
    origin = "https://mindfkd.com",
  ) {
    const r = await worker.fetch(
      new Request("https://mindfkd.com" + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          cookie: `__Host-mindfkd=${user}`,
          Origin: origin,
          "X-Mindfkd-Request": "1",
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    return {
      status: r.status,
      value: (await r.json()) as {
        id: string;
        run: Run;
        counts: { followers: number };
        players: { username: string; score: number }[];
        sharedRun: { id: string };
        player: { googleSub?: string; email?: string } | null;
      },
    };
  }
  assert.equal((await request("/api/runs/start", {}, "absent")).status, 401);
  assert.equal(
    (
      await request(
        "/api/profile",
        { username: "first", displayName: "First", bio: "" },
        "one",
        "https://evil.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/profile", {
        username: "first",
        displayName: "First",
        bio: "",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/api/profile",
        { username: "first", displayName: "Two", bio: "" },
        "two",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/api/profile",
        { username: "second", displayName: "Second", bio: "" },
        "two",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/follow", { username: "second", follow: true })).status,
    200,
  );
  await request("/api/follow", { username: "second", follow: true });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM follows").get()?.n, 1);
  assert.equal(
    (await request("/api/player?u=second")).value.counts.followers,
    1,
  );
  const start = await request("/api/runs/start", {});
  assert.equal(start.status, 200);
  const id = start.value.id;
  const state = JSON.parse(
    sqlite.prepare("SELECT state FROM runs WHERE id=?").get(id)!
      .state as string,
  );
  const first = await request("/api/runs/answer", {
    id,
    version: 0,
    answer: state.run.question.answer,
    score: 99999999,
  });
  assert.equal(first.status, 200);
  assert.ok(first.value.run.score < 1000);
  const duplicate = await request("/api/runs/answer", {
    id,
    version: 0,
    answer: state.run.question.answer,
  });
  assert.equal(duplicate.value.run.score, first.value.run.score);
  assert.equal(
    (await request("/api/runs/finish", { id, version: 1 }, "two")).status,
    404,
  );
  const current = JSON.parse(
    sqlite.prepare("SELECT state FROM runs WHERE id=?").get(id)!
      .state as string,
  );
  current.run.deadline = 0;
  sqlite
    .prepare("UPDATE runs SET state=? WHERE id=?")
    .run(JSON.stringify(current), id);
  const end = await request("/api/runs/finish", { id, version: 1 });
  assert.equal(end.value.run.phase, "gameOver");
  const board = await request("/api/leaderboard");
  assert.equal(board.value.players.length, 1);
  assert.equal(board.value.players[0].username, "first");
  assert.equal(board.value.players[0].score, first.value.run.score);
  const p = await request(`/api/player?u=first&run=${id}`);
  assert.equal(p.value.sharedRun.id, id);
  assert.equal(p.value.player!.googleSub, undefined);
  assert.equal(p.value.player!.email, undefined);
  await request("/api/auth/logout", {});
  assert.equal((await request("/api/me")).value.player, null);
  sqlite.close();
});
