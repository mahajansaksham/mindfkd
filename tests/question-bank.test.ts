import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { Env } from "../server/types";
import { reserveQuestion, reserveMatchDeck } from "../server/question-bank";
import { questions } from "../data/questions";
function fixture() {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files.filter((f) => !f.startsWith("0005")))
    db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const id of ["a", "b", "c"])
    db.prepare(
      "INSERT INTO players(id,google_sub,display_name,created_at) VALUES(?,?,?,0)",
    ).run(id, id, id);
  const q = questions[0];
  db.prepare(
    "INSERT INTO runs(id,player_id,state,status,created_at) VALUES('legacy','a','{}','finished',0)",
  ).run();
  db.prepare(
    "INSERT INTO question_events(run_id,question_id,topic_key,player_id,bank_version,difficulty,shown_at) VALUES('legacy',?,?,'a','old',?,1)",
  ).run(q.id, q.topicKey ?? q.id, q.difficulty);
  db.exec(readFileSync("drizzle/0005_sql_question_bank.sql", "utf8"));
  const env = {
    DB: {
      prepare(sql: string) {
        let args: unknown[] = [];
        const stmt = {
          bind(...values: unknown[]) {
            args = values;
            return stmt;
          },
          async first() {
            return db.prepare(sql).get(...(args as [])) ?? null;
          },
          async all() {
            return { results: db.prepare(sql).all(...(args as [])) };
          },
        };
        return stmt;
      },
    },
  } as unknown as Env;
  return { db, env };
}
test("SQL exact history: migration, concurrent reservations, shared decks and exhaustion", async () => {
  const { db, env } = fixture();
  try {
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM question_bank").get()!.n,
      1170,
    );
    assert.equal(
      db
        .prepare("SELECT source FROM player_question_seen WHERE player_id='a'")
        .get()!.source,
      "legacy:solo",
    );
    const picked = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        reserveQuestion(env, ["a"], "science", 1, `test:${i}`),
      ),
    );
    assert.ok(picked.every(Boolean));
    assert.equal(new Set(picked.map((q) => q!.topicKey ?? q!.id)).size, 12);
    const shared = await reserveMatchDeck(env, ["a", "b"], "science", "TEST");
    assert.equal(shared!.length, 10);
    assert.deepEqual(
      shared!.map((q) => q.difficulty),
      [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
    );
    const oldTopics = new Set(picked.map((q) => q!.topicKey ?? q!.id));
    assert.ok(shared!.every((q) => !oldTopics.has(q.topicKey ?? q.id)));
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM player_question_seen WHERE player_id='b'",
        )
        .get()!.n,
      10,
    );
    const mixed = await reserveQuestion(env, ["a"], "mixed", 1, "mixed");
    assert.ok(!oldTopics.has(mixed!.topicKey ?? mixed!.id));
    // An exhausted tier must not recycle history, skip difficulty, or partially reserve a match.
    db.exec("UPDATE question_bank SET active=0 WHERE difficulty=4");
    const before = db
      .prepare("SELECT COUNT(*) n FROM player_question_seen")
      .get()!.n;
    assert.equal(
      await reserveMatchDeck(env, ["a", "b"], "science", "EMPTY"),
      null,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM player_question_seen").get()!.n,
      before,
    );
    db.exec(
      "INSERT OR IGNORE INTO player_question_seen SELECT 'c',topic_key,id,1,'exhausted' FROM question_bank WHERE difficulty=1",
    );
    assert.equal(
      await reserveQuestion(env, ["c"], "mixed", 1, "exhausted"),
      null,
    );
  } finally {
    db.close();
  }
});
test("SQL catalog selects from 100,000 synthetic records without loading a bank into application memory", async () => {
  const { db, env } = fixture();
  try {
    db.exec("DELETE FROM question_bank; BEGIN");
    const insert = db.prepare(
      "INSERT INTO question_bank(id,topic_key,prompt_hash,genre,difficulty,sort_key,payload,bank_version) VALUES(?,?,?,'science',2,?,?,'TEST ONLY')",
    );
    for (let i = 0; i < 100000; i++) {
      const id = `synthetic-${i}`;
      insert.run(
        id,
        id,
        id,
        (i * 2654435761) >>> 0,
        JSON.stringify({
          id,
          topicKey: id,
          genre: "science",
          category: "Science",
          difficulty: 2,
          type: "choice",
          prompt: `Synthetic load fixture ${i}`,
          options: ["a", "b"],
          answer: "a",
        }),
      );
    }
    db.exec("COMMIT");
    const began = performance.now();
    const picked = await Promise.all(
      Array.from({ length: 20 }, () =>
        reserveQuestion(env, ["b"], "science", 2, "TEST ONLY"),
      ),
    );
    assert.equal(new Set(picked.map((q) => q!.id)).size, 20);
    const plan = db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM question_bank WHERE active=1 AND genre='science' AND difficulty=2 AND sort_key>=100 ORDER BY sort_key LIMIT 1",
      )
      .all();
    assert.match(JSON.stringify(plan), /bank_category_pick/);
    console.log(
      `100,000 synthetic SQL rows: 20 exact-history selections in ${(performance.now() - began).toFixed(1)}ms locally; no production latency claim`,
    );
  } finally {
    db.close();
  }
});
