import type { Env, Player } from "./types";
import type { Question } from "../lib/game";
import { RULES } from "../lib/rules";
import { dailySession } from "../lib/session";
import {
  makeSequence,
  startSequence,
  advanceSequence,
  utcDay,
  dailyNumber,
  resultSummary,
} from "../lib/sequence";
import { answerRanked, publicRun, type RankedState } from "./ranked";
import { currentPlayer, cookie, hash, setCookie, token } from "./auth";
import { MatchError } from "./matches";
import { BANK_VERSION } from "../lib/catalog";
const DAY = 86400000;
type SetRow = {
  id: string;
  kind: "daily" | "friend";
  day: string | null;
  creator_actor: string | null;
  creator_name: string;
  parent_id: string | null;
  deck: string;
  rules_version: number;
  bank_version: string;
  opens_at: number;
  expires_at: number;
};
type Attempt = {
  id: string;
  set_id: string;
  actor: string;
  state: string;
  answers: string;
  version: number;
  status: string;
  result: string | null;
  display_name: string;
};
const fail = (status: number, message: string): never => {
  throw new MatchError(status, message);
};
const validID = (id: unknown): id is string =>
  typeof id === "string" &&
  /^(daily-\d{4}-\d{2}-\d{2}|[a-f0-9-]{36})$/.test(id);
const output = (body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
async function readSet(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM challenge_sets WHERE id=?")
    .bind(id)
    .first<SetRow>();
}
async function deckFromSQL(env: Env, seed: number) {
  // Bound candidate pool even with a 100k catalog; only active, reviewed rows enter a set.
  const batches = await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      env.DB.prepare(
        "SELECT payload FROM question_bank WHERE active=1 AND difficulty=? ORDER BY ((sort_key + ?) % 2147483647),id LIMIT 80",
      )
        .bind(i + 1, seed % 2147483647)
        .all<{ payload: string }>(),
    ),
  );
  return makeSequence(
    batches.flatMap((b) =>
      b.results.map((r) => JSON.parse(r.payload) as Question),
    ),
    seed,
  );
}
async function prepareDaily(env: Env, date: string) {
  const id = `daily-${date}`,
    existing = await readSet(env, id);
  if (existing) return existing;
  const opens = Date.parse(date + "T00:00:00Z");
  const deck = await deckFromSQL(env, dailySession(date).seed);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO challenge_sets(id,kind,day,deck,rules_version,bank_version,created_at,opens_at,expires_at) VALUES(?,'daily',?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      date,
      JSON.stringify(deck),
      RULES.version,
      BANK_VERSION,
      Date.now(),
      opens,
      opens + DAY,
    )
    .run();
  return (await readSet(env, id))!;
}
async function identity(request: Request, env: Env, create: boolean) {
  const player = await currentPlayer(request, env);
  if (player)
    return {
      actor: "player:" + player.id,
      player,
      headers: {} as Record<string, string>,
    };
  let raw = cookie(request, "__Host-mindfkd-challenge");
  const headers: Record<string, string> = {};
  if (!raw && create) {
    raw = token();
    headers["Set-Cookie"] = setCookie(
      "__Host-mindfkd-challenge",
      raw,
      30 * 86400,
    );
  }
  return {
    actor: raw ? "guest:" + (await hash(raw)) : null,
    player: null as Player | null,
    headers,
  };
}
async function view(env: Env, set: SetRow, actor: string | null, now: number) {
  const own = actor
    ? await env.DB.prepare(
        "SELECT * FROM challenge_attempts WHERE set_id=? AND actor=?",
      )
        .bind(set.id, actor)
        .first<Attempt>()
    : null;
  const creator =
    set.kind === "friend"
      ? await env.DB.prepare(
          "SELECT display_name,result FROM challenge_attempts WHERE set_id=? AND actor=? AND status='finished'",
        )
          .bind(set.id, set.creator_actor)
          .first<{ display_name: string; result: string }>()
      : null;
  const board =
    set.kind === "daily"
      ? await env.DB.prepare(
          "SELECT a.display_name,p.username,a.result FROM challenge_attempts a JOIN players p ON p.id=a.player_id WHERE a.set_id=? AND a.status='finished' ORDER BY a.score DESC,a.finished_at,a.id LIMIT 25",
        )
          .bind(set.id)
          .all<{
            display_name: string;
            username: string | null;
            result: string;
          }>()
      : { results: [] };
  const opponents =
    set.kind === "friend"
      ? await env.DB.prepare(
          "SELECT display_name,result FROM challenge_attempts WHERE set_id=? AND actor<>? AND status='finished' ORDER BY score DESC,finished_at LIMIT 25",
        )
          .bind(set.id, set.creator_actor)
          .all<{ display_name: string; result: string }>()
      : { results: [] };
  return {
    opponents: opponents.results.map((r) => ({
      name: r.display_name,
      ...JSON.parse(r.result),
    })),
    id: set.id,
    kind: set.kind,
    day: set.day,
    number: set.day ? dailyNumber(set.day) : null,
    creatorName: set.creator_name,
    parentId: set.parent_id,
    expiresAt: set.expires_at,
    isCreator: actor === set.creator_actor,
    ready: set.kind === "daily" || !!creator,
    creatorResult: creator
      ? { name: creator.display_name, ...JSON.parse(creator.result) }
      : null,
    leaderboard: board.results.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      username: r.username,
      ...JSON.parse(r.result),
    })),
    attempt: own ? snapshot(own, now) : null,
  };
}
function snapshot(row: Attempt, now: number) {
  const state = JSON.parse(row.state) as RankedState;
  return {
    ...publicRun(state, now, row.id, row.version),
    result: row.result ? JSON.parse(row.result) : null,
    outcomes: (JSON.parse(row.answers) as { correct: boolean }[]).map(
      (a) => a.correct,
    ),
  };
}
export async function challengeAPI(
  request: Request,
  env: Env,
  input: Record<string, unknown>,
  now = Date.now(),
) {
  const url = new URL(request.url),
    action = url.pathname.split("/").pop(),
    post = request.method === "POST";
  const who = await identity(request, env, post);
  if (action === "daily" && !post) {
    const today = await prepareDaily(env, utcDay(now));
    // Prepare tomorrow before its UTC publication boundary. On a quiet day lazy preparation is the fallback.
    await prepareDaily(env, utcDay(now + DAY));
    return output(await view(env, today, who.actor, now), who.headers);
  }
  if (action === "create" && post) {
    if (!who.actor) fail(401, "Could not create challenge identity");
    if (
      input.requestId !== undefined &&
      (typeof input.requestId !== "string" ||
        !/^[a-f0-9-]{36}$/.test(input.requestId))
    )
      fail(400, "Invalid creation request");
    if (typeof input.requestId === "string") {
      const existing = await readSet(env, input.requestId);
      if (existing) {
        if (existing.creator_actor !== who.actor)
          fail(409, "Creation request already used");
        return output(await view(env, existing, who.actor, now), who.headers);
      }
    }
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM challenge_sets WHERE creator_actor=? AND created_at>?",
    )
      .bind(who.actor, now - 3600000)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= 20)
      fail(429, "Please wait before making more challenges.");
    let parent: SetRow | null = null;
    if (input.parentId !== undefined) {
      if (!validID(input.parentId)) fail(400, "Invalid rematch");
      parent = await readSet(env, input.parentId as string);
      const played =
        parent &&
        (await env.DB.prepare(
          "SELECT id FROM challenge_attempts WHERE set_id=? AND actor=? AND status='finished'",
        )
          .bind(parent.id, who.actor)
          .first());
      if (!parent || parent.kind !== "friend" || !played)
        fail(403, "Finish this challenge before a rematch.");
    }
    const id =
        typeof input.requestId === "string"
          ? input.requestId
          : crypto.randomUUID(),
      seed = crypto.getRandomValues(new Uint32Array(1))[0],
      deck = await deckFromSQL(env, seed);
    const name = who.player?.display_name ?? "A friend";
    const changed = await env.DB.prepare(
      "INSERT INTO challenge_sets(id,kind,creator_actor,creator_name,parent_id,deck,rules_version,bank_version,created_at,opens_at,expires_at) SELECT ?,'friend',?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM challenge_sets WHERE creator_actor=? AND created_at>?)<20",
    )
      .bind(
        id,
        who.actor,
        name,
        parent?.id ?? null,
        JSON.stringify(deck),
        RULES.version,
        BANK_VERSION,
        now,
        now,
        now + 30 * DAY,
        who.actor,
        now - 3600000,
      )
      .run();
    if (!changed.meta.changes)
      fail(429, "Please wait before making more challenges.");
    return output(
      await view(env, (await readSet(env, id))!, who.actor, now),
      who.headers,
    );
  }
  if (action === "set" && !post) {
    const id = url.searchParams.get("id");
    if (!validID(id)) fail(400, "Invalid challenge link");
    const set = await readSet(env, id!);
    if (!set || set.opens_at > now) fail(404, "Challenge not found");
    return output(await view(env, set!, who.actor, now), who.headers);
  }
  if (action === "start" && post) {
    if (!validID(input.setId)) fail(400, "Invalid challenge");
    const set = await readSet(env, input.setId as string);
    if (!set || set.opens_at > now) fail(404, "Challenge not found");
    if (set!.kind === "daily" && !who.player)
      fail(401, "Sign in for your one official Daily attempt.");
    if (!who.actor) fail(401, "Could not create challenge identity");
    const existing = await env.DB.prepare(
      "SELECT * FROM challenge_attempts WHERE set_id=? AND actor=?",
    )
      .bind(set!.id, who.actor)
      .first<Attempt>();
    if (existing) return output(snapshot(existing, now), who.headers);
    if (now >= set!.expires_at)
      fail(410, "This challenge has ended. Start a new one.");
    if (set!.rules_version !== RULES.version)
      fail(409, "This challenge uses older rules. Make a new one.");
    if (set!.kind === "friend" && set!.creator_actor !== who.actor) {
      const done = await env.DB.prepare(
        "SELECT id FROM challenge_attempts WHERE set_id=? AND actor=? AND status='finished'",
      )
        .bind(set!.id, set!.creator_actor)
        .first();
      if (!done)
        fail(
          409,
          "Your friend is still setting their score. Come back shortly.",
        );
    }
    const state = startSequence(JSON.parse(set!.deck), now);
    state.run.deadline = Math.min(state.run.deadline, set!.expires_at);
    const id = crypto.randomUUID();
    const startWrite = env.DB.prepare(
      "INSERT OR IGNORE INTO challenge_attempts(id,set_id,actor,player_id,display_name,state,created_at) VALUES(?,?,?,?,?,?,?)",
    ).bind(
      id,
      set!.id,
      who.actor,
      who.player?.id ?? null,
      who.player?.display_name ?? "Guest",
      JSON.stringify(state),
      now,
    );
    const writes = [startWrite];
    if (who.player) {
      const q = state.run.question!;
      writes.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source) VALUES(?,?,?,?,?)",
        ).bind(
          who.player.id,
          q.topicKey ?? q.id,
          q.id,
          now,
          "challenge:" + set!.id,
        ),
      );
    }
    await env.DB.batch(writes);
    const attempt = await env.DB.prepare(
      "SELECT * FROM challenge_attempts WHERE set_id=? AND actor=?",
    )
      .bind(set!.id, who.actor)
      .first<Attempt>();
    return output(snapshot(attempt!, now), who.headers);
  }
  if (["answer", "next", "finish"].includes(action ?? "") && post) {
    if (
      !validID(input.id) ||
      !Number.isSafeInteger(input.version) ||
      Number(input.version) < 0
    )
      fail(400, "Invalid attempt");
    const row = await env.DB.prepare(
      "SELECT * FROM challenge_attempts WHERE id=? AND actor=?",
    )
      .bind(input.id, who.actor)
      .first<Attempt>();
    if (!row) fail(404, "Attempt not found");
    if (row!.status === "finished" || row!.version !== input.version)
      return output(snapshot(row!, now), who.headers);
    const set = (await readSet(env, row!.set_id))!,
      state = JSON.parse(row!.state) as RankedState;
    let next = state;
    const answers = JSON.parse(row!.answers) as {
      correct: boolean;
      ms: number;
    }[];
    if (now >= Math.min(state.run.deadline, set.expires_at))
      next = {
        ...state,
        run: { ...state.run, phase: "gameOver", reason: "time" },
      };
    else if (action === "answer") {
      const a = input.answer,
        q = state.run.question;
      const valid =
        q &&
        (q.type === "order"
          ? Array.isArray(a) &&
            a.length === q.options.length &&
            new Set(a).size === a.length &&
            a.every((v) => typeof v === "string" && q.options.includes(v))
          : typeof a === "string" && q.options.includes(a));
      if (!valid) fail(400, "Choose one of the available answers.");
      next = answerRanked(state, a as string | string[], now);
      next.run.deadline = Math.min(next.run.deadline, set.expires_at);
      if (state.run.phase === "playing" && next.run.feedback)
        answers.push({
          correct: next.run.feedback.correct,
          ms: next.run.feedback.responseTimeMs ?? 0,
        });
    } else if (action === "next")
      next = advanceSequence(state, JSON.parse(set.deck), now);
    if (next === state) return output(snapshot(row!, now), who.headers);
    const finished = next.run.phase === "gameOver",
      result = finished
        ? resultSummary(
            next.run,
            answers.map((a) => a.ms),
          )
        : null;
    const serialized = JSON.stringify(next);
    const update = env.DB.prepare(
      "UPDATE challenge_attempts SET state=?,answers=?,version=version+1,status=?,score=?,result=?,finished_at=? WHERE id=? AND actor=? AND version=?",
    ).bind(
      serialized,
      JSON.stringify(answers),
      finished ? "finished" : "active",
      next.run.score,
      result ? JSON.stringify(result) : null,
      finished ? now : null,
      row!.id,
      who.actor,
      row!.version,
    );
    const writes = [update];
    if (
      who.player &&
      next.run.question?.id !== state.run.question?.id &&
      next.run.question
    ) {
      const q = next.run.question;
      writes.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO player_question_seen(player_id,topic_key,question_id,first_seen_at,source) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM challenge_attempts WHERE id=? AND version=? AND state=?)",
        ).bind(
          who.player.id,
          q.topicKey ?? q.id,
          q.id,
          now,
          "challenge:" + set.id,
          row!.id,
          row!.version + 1,
          serialized,
        ),
      );
    }
    const [changed] = await env.DB.batch(writes);
    if (!changed.meta.changes) {
      const latest = await env.DB.prepare(
        "SELECT * FROM challenge_attempts WHERE id=? AND actor=?",
      )
        .bind(row!.id, who.actor)
        .first<Attempt>();
      return output(snapshot(latest!, now), who.headers);
    }
    return output(
      snapshot(
        {
          ...row!,
          state: serialized,
          answers: JSON.stringify(answers),
          version: row!.version + 1,
          result: result ? JSON.stringify(result) : null,
        },
        now,
      ),
      who.headers,
    );
  }
  return fail(404, "Not found");
}
