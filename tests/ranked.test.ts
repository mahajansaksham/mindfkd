import type { Run } from "../lib/game";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
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
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const reads: string[] = [];
  let staleRunCount = false;
  function prepare(sql: string) {
    let args: unknown[] = [];
    const obj = {
      bind(...v: unknown[]) {
        args = v;
        return obj;
      },
      async first() {
        reads.push(sql);
        if (staleRunCount && sql.startsWith("SELECT COUNT(*) AS n FROM runs"))
          return { n: 0 };
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
    ASSETS: {
      fetch: async () =>
        new Response("<html>asset</html>", {
          headers: { "Content-Type": "text/html" },
        }),
    },
    GOOGLE_CLIENT_ID: "test-client",
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
      headers: r.headers,
      value: (await r.json()) as {
        id: string;
        nonce: string;
        genre: string;
        version: number;
        isMe: boolean;
        run: Run;
        counts: { followers: number };
        players: { username: string; score: number; genre: string }[];
        sharedRun: { id: string };
        player: {
          id?: string;
          username?: string;
          googleSub?: string;
          email?: string;
        } | null;
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
  const secondStart = await request("/api/runs/start", {});
  assert.notEqual(
    secondStart.value.run.question?.id,
    start.value.run.question?.id,
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM question_events").get()?.n,
    2,
  );
  const state = JSON.parse(
    sqlite.prepare("SELECT state FROM runs WHERE id=?").get(id)!
      .state as string,
  );
  reads.length = 0;
  const first = await request("/api/runs/answer", {
    id,
    version: 0,
    answer: state.run.question.answer,
    score: 99999999,
  });
  assert.equal(first.status, 200);
  assert.equal(
    reads.length,
    1,
    "accepted ranked answer uses one authenticated state read",
  );
  assert.ok(first.value.run.score < 1000);
  const duplicate = await request("/api/runs/answer", {
    id,
    version: 0,
    answer: state.run.question.answer,
  });
  assert.equal(duplicate.value.run.score, first.value.run.score);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM question_events WHERE answered_at IS NOT NULL",
      )
      .get()?.n,
    1,
  );
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
  assert.equal(
    (await request("/api/leaderboard?season=launch")).value.players.length,
    0,
  );
  assert.equal(board.value.players[0].username, "first");
  assert.equal(board.value.players[0].score, first.value.run.score);
  const p = await request(`/api/player?u=first&run=${id}`);
  assert.equal(p.value.sharedRun.id, id);
  assert.equal(p.value.player!.googleSub, undefined);
  assert.equal(p.value.player!.email, undefined);
  assert.equal(
    p.value.player!.id,
    undefined,
    "internal account ID must not leave API",
  );
  assert.equal(p.value.isMe, true);
  assert.equal(
    (await request("/api/player?u=first", undefined, "two")).value.isMe,
    false,
  );
  assert.equal(
    (await request("/api/player?u=first", undefined, "absent")).value.isMe,
    false,
  );
  assert.equal((await request("/api/me")).value.player!.id, undefined);
  assert.equal(
    (
      await request(
        "/api/runs/answer",
        {
          id: secondStart.value.id,
          version: 0,
          answer: "x",
          isMe: true,
          player_id: "one",
        },
        "two",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/api/runs/next",
        { id: secondStart.value.id, version: 0 },
        "two",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/runs/answer", {
        id: secondStart.value.id,
        version: -1,
        answer: "x",
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/runs/start", { genre: "invalid" })).status,
    400,
  );
  assert.equal((await request("/api/leaderboard?genre=invalid")).status, 400);
  assert.equal(
    (
      await request("/api/profile", {
        username: "first",
        displayName: "x".repeat(20000),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await request("/api/profile", {
        username: "first",
        displayName: "🙂".repeat(5000),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await request("/api/profile", {
        username: "first",
        displayName: "First",
        id: "two",
        isMe: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/player?u=second")).value.player!.username,
    "second",
  );
  assert.equal(
    (
      await request("/api/profile", {
        username: "renamed",
        displayName: "First",
      })
    ).status,
    400,
  );
  assert.equal((await request("/api/question_events")).status, 404);
  const politics = await request("/api/runs/start", { genre: "politics" });
  assert.equal(politics.value.genre, "politics");
  assert.equal(politics.value.run.question?.genre, "politics");
  const politicsState = JSON.parse(
    sqlite.prepare("SELECT state FROM runs WHERE id=?").get(politics.value.id)!
      .state as string,
  );
  const politicsAnswer = await request("/api/runs/answer", {
    id: politics.value.id,
    version: 0,
    genre: "sports",
    answer: politicsState.run.question.answer,
  });
  assert.equal(
    politicsAnswer.value.genre,
    "politics",
    "category cannot change during a run",
  );
  const finishedPolitics = JSON.parse(
    sqlite.prepare("SELECT state FROM runs WHERE id=?").get(politics.value.id)!
      .state as string,
  );
  finishedPolitics.run.deadline = 0;
  sqlite
    .prepare("UPDATE runs SET state=? WHERE id=?")
    .run(JSON.stringify(finishedPolitics), politics.value.id);
  await request("/api/runs/finish", {
    id: politics.value.id,
    version: politicsAnswer.value.version,
  });
  const politicsBoard = await request("/api/leaderboard?genre=politics");
  assert.equal(politicsBoard.value.players.length, 1);
  assert.equal(politicsBoard.value.players[0].genre, "politics");
  assert.equal(
    (await request("/api/leaderboard?genre=sports")).value.players.length,
    0,
  );
  const overall = await request("/api/leaderboard?genre=overall");
  assert.equal(overall.value.players.length, 1);
  assert.equal(
    overall.value.players[0].score,
    Math.max(first.value.run.score, politicsAnswer.value.run.score),
  );
  assert.equal(
    overall.value.players[0].genre,
    politicsAnswer.value.run.score > first.value.run.score
      ? "politics"
      : "mixed",
  );
  const nonce = await request("/api/auth/nonce", {});
  assert.ok(nonce.headers.get("set-cookie")?.includes("HttpOnly"));
  const nonceRequest = () =>
    worker.fetch(
      new Request("https://mindfkd.com/api/auth/google", {
        method: "POST",
        headers: {
          Origin: "https://mindfkd.com",
          "X-Mindfkd-Request": "1",
          "Content-Type": "application/json",
          cookie: `__Host-mindfkd-nonce=${nonce.value.nonce}`,
        },
        body: JSON.stringify({ credential: "not-a-valid-token" }),
      }),
      env,
    );
  assert.equal((await nonceRequest()).status, 401);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM auth_nonces").get()!.n,
    0,
  );
  assert.equal((await nonceRequest()).status, 401, "nonce replay rejected");
  const assets = await worker.fetch(new Request("https://mindfkd.com/"), env);
  assert.equal(assets.headers.get("x-frame-options"), "DENY");
  assert.match(
    assets.headers.get("content-security-policy")!,
    /frame-ancestors 'none'/,
  );
  assert.equal(p.headers.get("x-content-type-options"), "nosniff");
  // Simulate another request using a stale precheck. The write must still enforce 120/hour.
  let n = Number(
    sqlite
      .prepare("SELECT COUNT(*) AS n FROM runs WHERE player_id=?")
      .get("one")!.n,
  );
  while (n++ < 120)
    sqlite
      .prepare(
        "INSERT INTO runs(id,player_id,state,status,created_at) VALUES(?,?,?,'active',?)",
      )
      .run(crypto.randomUUID(), "one", "{}", Date.now());
  const eventsBefore = sqlite
    .prepare("SELECT COUNT(*) AS n FROM question_events")
    .get()!.n;
  staleRunCount = true;
  assert.equal((await request("/api/runs/start", {})).status, 429);
  staleRunCount = false;
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM question_events").get()!.n,
    eventsBefore,
  );
  await request("/api/auth/logout", {});
  assert.equal((await request("/api/me")).value.player, null);
  sqlite.close();
});
