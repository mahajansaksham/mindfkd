import type { Env } from "./types";
import type { Genre } from "../lib/genres";
import { type Question, shuffle } from "../lib/game";

// A single SQL statement selects and reserves for EVERY recipient. Concurrent
// requests cannot select the same topic for an overlapping set of players.
export async function reserveQuestion(
  env: Env,
  playerIds: string[],
  genre: Genre,
  difficulty: number,
  source: string,
): Promise<Question | null> {
  const anchor = crypto.getRandomValues(new Uint32Array(1))[0];
  const recipients = JSON.stringify([...new Set(playerIds)]);
  for (const direction of [">=", "<"] as const) {
    const result = await env.DB.prepare(
      `
      WITH recipients AS (SELECT p.id FROM players p JOIN json_each(?) j ON p.id=j.value),
      chosen AS (
        SELECT q.id,q.topic_key FROM question_bank q
        WHERE q.active=1 AND q.difficulty=? ${genre === "mixed" ? "" : "AND q.genre=?"}
          AND q.sort_key ${direction} ?
          AND NOT EXISTS (SELECT 1 FROM player_question_seen s
            WHERE s.topic_key=q.topic_key AND s.player_id IN (SELECT id FROM recipients))
        ORDER BY q.sort_key,q.id LIMIT 1
      )
      INSERT INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source)
      SELECT r.id,q.topic_key,q.id,?,? FROM recipients r CROSS JOIN chosen q
      RETURNING question_id
    `,
    )
      .bind(
        recipients,
        difficulty,
        ...(genre === "mixed" ? [] : [genre]),
        anchor,
        Date.now(),
        source,
      )
      .all<{ question_id: string }>();
    if (!result.results.length) continue;
    const row = await env.DB.prepare(
      "SELECT payload FROM question_bank WHERE id=?",
    )
      .bind(result.results[0].question_id)
      .first<{ payload: string }>();
    if (!row) throw new Error("Reserved question missing");
    const q = JSON.parse(row.payload) as Question;
    return {
      ...q,
      options: ["higher", "boolean", "number"].includes(q.type)
        ? q.options
        : shuffle(
            q.options,
            () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
          ),
    };
  }
  return null;
}

// Reserve a whole shared deck atomically: no partial consumption on exhaustion.
export async function reserveMatchDeck(
  env: Env,
  playerIds: string[],
  genre: Genre,
  code: string,
): Promise<Question[] | null> {
  const anchor = crypto.getRandomValues(new Uint32Array(1))[0];
  const result = await env.DB.prepare(
    `
    WITH recipients AS (SELECT p.id FROM players p JOIN json_each(?) j ON p.id=j.value),
    facts AS (
      SELECT q.*,ROW_NUMBER() OVER (PARTITION BY q.topic_key ORDER BY q.sort_key,q.id) AS fact_rank
      FROM question_bank q WHERE q.active=1 AND q.difficulty BETWEEN 1 AND 4
      ${genre === "mixed" ? "" : "AND q.genre=?"}
      AND NOT EXISTS (SELECT 1 FROM player_question_seen s
        WHERE s.topic_key=q.topic_key AND s.player_id IN (SELECT id FROM recipients))
    ), ranked AS (
      SELECT *,ROW_NUMBER() OVER (PARTITION BY difficulty ORDER BY (sort_key < ?),sort_key,id) AS tier_rank
      FROM facts WHERE fact_rank=1
    ), chosen AS (
      SELECT * FROM ranked WHERE tier_rank <= CASE WHEN difficulty<=2 THEN 3 ELSE 2 END
    )
    INSERT INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source)
    SELECT r.id,q.topic_key,q.id,?,? FROM recipients r CROSS JOIN chosen q
    WHERE (SELECT COUNT(*) FROM chosen)=10
    RETURNING question_id
  `,
  )
    .bind(
      JSON.stringify([...new Set(playerIds)]),
      ...(genre === "mixed" ? [] : [genre]),
      anchor,
      Date.now(),
      `match:${code}`,
    )
    .all<{ question_id: string }>();
  if (!result.results.length) return null;
  const ids = [...new Set(result.results.map((r) => r.question_id))];
  const rows = await env.DB.prepare(
    "SELECT payload FROM question_bank WHERE id IN (SELECT value FROM json_each(?)) ORDER BY difficulty,sort_key,id",
  )
    .bind(JSON.stringify(ids))
    .all<{ payload: string }>();
  return rows.results.map((row) => {
    const q = JSON.parse(row.payload) as Question;
    return {
      ...q,
      options: ["higher", "boolean", "number"].includes(q.type)
        ? q.options
        : shuffle(
            q.options,
            () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
          ),
    };
  });
}
