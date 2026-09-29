// Local, bounded review catalog. Importing NEVER changes the playable bank.
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    input: { type: "string" },
    database: { type: "string", default: "content/review/catalog.sqlite" },
  },
});
if (!values.input)
  throw Error(
    "Usage: npm run questions:import -- --input candidates.ndjson [--database path.sqlite]",
  );
const input = resolve(values.input),
  path = resolve(values.database);
if ((await stat(input)).size > 256 * 1024 * 1024)
  throw Error("Split imports into files below 256MB");
await mkdir(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS candidates (
 id TEXT PRIMARY KEY,prompt_hash TEXT NOT NULL UNIQUE,topic_key TEXT NOT NULL,
 genre TEXT NOT NULL,difficulty INTEGER NOT NULL,prompt TEXT NOT NULL,answer TEXT NOT NULL,options TEXT NOT NULL,
 source_url TEXT NOT NULL,license TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',imported_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS candidate_review ON candidates(status,genre,difficulty,id);
CREATE INDEX IF NOT EXISTS candidate_topic ON candidates(topic_key);`);
const insert = db.prepare(
  "INSERT OR IGNORE INTO candidates(id,prompt_hash,topic_key,genre,difficulty,prompt,answer,options,source_url,license,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
);
const normalized = (s) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const genres = new Set([
  "sports",
  "politics",
  "history",
  "geography",
  "science",
  "mixed",
]);
const licenses = new Set([
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "original",
  "licensed",
]);
const report = {
  lines: 0,
  inserted: 0,
  duplicates: 0,
  rejected: 0,
  exampleRejectedLines: [],
};
let batch = 0;
const started = performance.now();
db.exec("BEGIN");
try {
  for await (const line of createInterface({
    input: createReadStream(input),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    if (++report.lines > 100000)
      throw Error(
        "Maximum 100,000 candidates per batch file; split larger sources",
      );
    try {
      if (line.length > 8192) throw Error("oversize");
      const q = JSON.parse(line);
      if (
        !q ||
        typeof q !== "object" ||
        typeof q.id !== "string" ||
        q.id.length > 160 ||
        !q.id ||
        !genres.has(q.genre) ||
        !Number.isInteger(q.difficulty) ||
        q.difficulty < 1 ||
        q.difficulty > 7
      )
        throw Error("metadata");
      if (
        typeof q.prompt !== "string" ||
        q.prompt.length < 8 ||
        q.prompt.length > 500 ||
        typeof q.answer !== "string" ||
        !q.answer ||
        q.answer.length > 200
      )
        throw Error("content");
      if (
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some(
          (a) => typeof a !== "string" || !a.trim() || a.length > 200,
        ) ||
        new Set(q.options.map(normalized)).size !== 4 ||
        !q.options.includes(q.answer)
      )
        throw Error("choices");
      if (
        !licenses.has(q.license) ||
        typeof q.sourceUrl !== "string" ||
        q.sourceUrl.length > 1000 ||
        new URL(q.sourceUrl).protocol !== "https:"
      )
        throw Error("source");
      if (
        q.license === "licensed" &&
        (!q.licenseReference || typeof q.licenseReference !== "string")
      )
        throw Error("rights reference");
      const hash = createHash("sha256")
        .update(normalized(q.prompt))
        .digest("hex");
      const topicKey =
        typeof q.topicKey === "string" && q.topicKey.length <= 160
          ? q.topicKey
          : hash;
      const changes = insert.run(
        q.id,
        hash,
        topicKey,
        q.genre,
        q.difficulty,
        q.prompt.trim(),
        q.answer,
        JSON.stringify(q.options),
        q.sourceUrl,
        q.license === "licensed"
          ? `licensed: ${q.licenseReference}`
          : q.license,
        new Date().toISOString(),
      ).changes;
      if (changes) report.inserted++;
      else report.duplicates++;
    } catch {
      report.rejected++;
      if (report.exampleRejectedLines.length < 5)
        report.exampleRejectedLines.push(report.lines);
    }
    if (++batch === 500) {
      db.exec("COMMIT");
      db.exec("BEGIN");
      batch = 0;
    }
  }
  db.exec("COMMIT");
  db.exec("PRAGMA optimize");
  console.log(
    JSON.stringify(
      {
        ...report,
        totalPending: db
          .prepare(
            "SELECT COUNT(*) AS n FROM candidates WHERE status='pending'",
          )
          .get().n,
        elapsedMs: Math.round(performance.now() - started),
        published: 0,
      },
      null,
      2,
    ),
  );
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
