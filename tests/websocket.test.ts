import { test } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { MatchView } from "../lib/matches";
test("actual Worker WebSockets: upgrades, names, cross-client revisions, fast replies and authorization", async () => {
  const bundle = await build({
    entryPoints: ["server/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  const mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-08-06",
    d1Databases: ["DB"],
  });
  try {
    const db = await mf.getD1Database("DB");
    for (const file of (await readdir("drizzle"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      for (const sql of (await readFile(`drizzle/${file}`, "utf8"))
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
    }
    for (const id of ["one", "two"]) {
      await db
        .prepare(
          "INSERT INTO players(id,google_sub,username,display_name,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(id, id, id, id, Date.now())
        .run();
      await db
        .prepare(
          "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)",
        )
        .bind(
          createHash("sha256").update(id).digest("hex"),
          id,
          Date.now() + 3600000,
        )
        .run();
    }
    async function http(action: string, data: unknown, user = "one") {
      const r = await mf.dispatchFetch(
        `https://mindfkd.com/api/matches/${action}`,
        {
          method: "POST",
          headers: {
            Origin: "https://mindfkd.com",
            cookie: `__Host-mindfkd=${user}`,
            "Content-Type": "application/json",
            "X-Mindfkd-Request": "1",
          },
          body: JSON.stringify(data),
        },
      );
      assert.equal(r.status, 200, await r.clone().text());
      return (await r.json()) as MatchView;
    }
    const room = await http("create", { mode: "teams", genre: "science" });
    await http("join", { code: room.code, team: 2 }, "two");
    const denied = await mf.dispatchFetch(
      `https://mindfkd.com/api/matches/socket?code=${room.code}`,
      {
        headers: {
          Upgrade: "websocket",
          Origin: "https://evil.example",
          cookie: "__Host-mindfkd=one",
        },
      },
    );
    assert.equal(denied.status, 403);
    async function connection(user: string) {
      const r = await mf.dispatchFetch(
        `https://mindfkd.com/api/matches/socket?code=${room.code}`,
        {
          headers: {
            Upgrade: "websocket",
            Origin: "https://mindfkd.com",
            cookie: `__Host-mindfkd=${user}`,
          },
        },
      );
      assert.equal(r.status, 101);
      const ws = r.webSocket!;
      type Packet = {
        type: string;
        requestId?: string;
        error?: string;
        value: MatchView;
      };
      const queued: Packet[] = [];
      let serial = 0;
      const waiting = new Map<
        string,
        {
          resolve: (p: Packet) => void;
          reject: (e: Error) => void;
          timer: ReturnType<typeof setTimeout>;
        }
      >();
      ws.addEventListener("message", (e) => {
        const p = JSON.parse(String(e.data)) as Packet;
        const key = p.requestId ?? "sync";
        const wait = waiting.get(key);
        if (wait) {
          clearTimeout(wait.timer);
          waiting.delete(key);
          wait.resolve(p);
        } else queued.push(p);
      });
      ws.accept();
      const next = (key: string) => {
        const i = queued.findIndex((p) => (p.requestId ?? "sync") === key);
        if (i >= 0) return Promise.resolve(queued.splice(i, 1)[0]);
        return new Promise<Packet>((resolve, reject) => {
          const timer = setTimeout(() => {
            waiting.delete(key);
            reject(Error("WebSocket response timed out"));
          }, 3000);
          waiting.set(key, { resolve, reject, timer });
        });
      };
      await next("sync");
      return {
        ws,
        async send(action: string, data: Record<string, unknown> = {}) {
          const requestId = action === "sync" ? undefined : String(++serial);
          const result = next(requestId ?? "sync");
          ws.send(
            JSON.stringify({
              action,
              requestId,
              data,
              sentAt: performance.now(),
            }),
          );
          return result;
        },
      };
    }
    const a = await connection("one"),
      b = await connection("two");
    const named = await a.send("name", { name: "Quiz Wizards", team: 2 });
    assert.equal(named.value.teams[0].name, "Quiz Wizards");
    assert.equal(named.value.teams[1].name, "Team 2");
    const observed = await b.send("sync");
    assert.equal(observed.value.teams[0].name, "Quiz Wizards");
    assert.ok(observed.value.revision > room.revision);
    assert.equal((await a.send("name", { name: "<script>" })).type, "error");
    await a.send("ready", { ready: true });
    await b.send("ready", { ready: true });
    assert.equal((await b.send("start")).type, "error");
    await a.send("start");
    await db
      .prepare(
        "UPDATE matches SET start_at=?,end_at=?,revision=revision+1 WHERE code=?",
      )
      .bind(Date.now() - 500, Date.now() + 119500, room.code)
      .run();
    const row = await db
      .prepare("SELECT questions FROM matches WHERE code=?")
      .bind(room.code)
      .first<{ questions: string }>();
    const q = JSON.parse(row!.questions)[0];
    const began = performance.now();
    const syncing = a.send("sync");
    const reply = await a.send("answer", { round: 0, answer: q.answer });
    await syncing;
    const elapsed = performance.now() - began;
    assert.equal(reply.value.answered, true);
    assert.equal(reply.value.correct, null);
    assert.equal(reply.value.question!.answer, "");
    assert.ok(elapsed < 2000, `Local answer round-trip ${elapsed}ms`);
    assert.equal((await a.send("name", { name: "Too late" })).type, "error");
    await a.send("answer", { round: 0, answer: q.options[0] });
    assert.equal(
      (await db
        .prepare(
          "SELECT COUNT(*) AS n FROM match_answers WHERE code=? AND player_id=?",
        )
        .bind(room.code, "one")
        .first<{ n: number }>())!.n,
      1,
    );
    // Sync messages have a 200ms guard; independent browser clients run at 250ms.
    await new Promise((r) => setTimeout(r, 220));
    const changed = await b.send("sync");
    assert.equal(
      changed.value.members.find((m) => m.username === "one")!.answered,
      true,
    );
    assert.equal(
      changed.value.members.find((m) => m.username === "one")!.score,
      0,
    );
    await new Promise((r) => setTimeout(r, 220));
    assert.equal((await b.send("sync")).type, "pong");
    const closure = new Promise<number>((resolve) =>
      a.ws.addEventListener("close", (e) => resolve(e.code)),
    );
    await db
      .prepare("DELETE FROM sessions WHERE player_id=?")
      .bind("one")
      .run();
    a.ws.send(
      JSON.stringify({
        action: "ready",
        requestId: "revoked",
        data: { ready: false },
      }),
    );
    assert.equal(await closure, 1008);
    b.ws.close();
    console.log(
      `Local Worker WebSocket answer acknowledgement: ${elapsed.toFixed(1)}ms (not a production latency guarantee)`,
    );
  } finally {
    await mf.dispose();
  }
});
