// One-time catalog migration generator. Future releases must create a NEW migration.
import { questions } from "../data/questions";
import { BANK_VERSION } from "../lib/catalog";
import { categoryGenre } from "../lib/genres";
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
const target = process.argv[2];
if (!target || !/^drizzle\/\d+_[\w-]+\.sql$/.test(target))
  throw Error("Pass a newly generated SQL migration path");
const quote = (v: string | number) =>
  typeof v === "number" ? String(v) : "'" + v.replaceAll("'", "''") + "'";
const statements = questions.map((q) => {
  const normalized = q.prompt
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const hash = createHash("sha256").update(normalized).digest("hex");
  const sort = createHash("sha256").update(q.id).digest().readUInt32BE();
  return `INSERT INTO question_bank(id,topic_key,prompt_hash,genre,difficulty,sort_key,payload,bank_version) VALUES(${[q.id, q.topicKey ?? q.id, hash, q.genre ?? categoryGenre(q.category), q.difficulty, sort, JSON.stringify(q), BANK_VERSION].map(quote).join(",")});`;
});
statements.push(`INSERT OR IGNORE INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source)
SELECT player_id,topic_key,question_id,MIN(shown_at),'legacy:solo' FROM question_events GROUP BY player_id,topic_key;`);
statements.push(`INSERT OR IGNORE INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source)
SELECT mm.player_id,COALESCE(json_extract(q.value,'$.topicKey'),json_extract(q.value,'$.id')),json_extract(q.value,'$.id'),m.created_at,'legacy:match'
FROM matches m JOIN match_members mm ON mm.code=m.code JOIN json_each(m.questions) q WHERE m.status IN ('active','finished');`);
appendFileSync(
  target,
  "\n--> statement-breakpoint\n" +
    statements.join("\n--> statement-breakpoint\n") +
    "\n",
);
console.log(
  `Seeded ${questions.length} approved questions; historical exposure backfill included`,
);
