import { BANK_VERSION, CURRENT_SEASON, SEASONS } from "../lib/catalog";
import type { QuestionHistory } from "../lib/game";
import type { Env, Player } from "./types";
import {
  cookie,
  setCookie,
  token,
  hash,
  currentPlayer,
  verifyGoogle,
} from "./auth";
import {
  newRanked,
  answerRanked,
  advanceRanked,
  publicRun,
  RankedState,
} from "./ranked";
const origins = new Set([
  "https://mindfkd.com",
  "https://www.mindfkd.com",
  "https://mindfkd.sakshammahajan0404.chatgpt.site",
]);
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Expected JSON");
  const text = await request.text();
  if (text.length > 16000) fail(413, "Request too large");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fail(400, "Expected a JSON object");
    return parsed;
  } catch {
    return fail(400, "Invalid request");
  }
}
async function requirePlayer(request: Request, env: Env) {
  return (
    (await currentPlayer(request, env)) ?? fail(401, "Sign in to continue")
  );
}
function publicPlayer(p: Player) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    bio: p.bio,
    createdAt: p.created_at,
  };
}
const leaderboardSQL = `WITH best AS (SELECT r.*,ROW_NUMBER() OVER (PARTITION BY r.player_id ORDER BY r.score DESC,r.level DESC,r.finished_at ASC,r.id ASC) AS best_run FROM runs r WHERE r.status='finished' AND r.season=?), ranked AS (SELECT p.username,p.display_name,b.score,b.level,b.id AS run_id,ROW_NUMBER() OVER (ORDER BY b.score DESC,b.level DESC,b.finished_at ASC,b.id ASC) AS rank FROM best b JOIN players p ON p.id=b.player_id WHERE b.best_run=1 AND p.username IS NOT NULL) `;
async function questionHistory(
  env: Env,
  playerId: string,
): Promise<QuestionHistory> {
  const rows = await env.DB.prepare(
    "SELECT topic_key,MAX(shown_at) AS last_seen FROM question_events WHERE player_id=? GROUP BY topic_key",
  )
    .bind(playerId)
    .all<{ topic_key: string; last_seen: number }>();
  return Object.fromEntries(
    rows.results.map((r) => [r.topic_key, r.last_seen]),
  );
}
async function api(request: Request, env: Env) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method,
    now = Date.now();
  if (
    method !== "GET" &&
    (!origins.has(request.headers.get("origin") ?? "") ||
      request.headers.get("x-mindfkd-request") !== "1")
  )
    fail(403, "Invalid request origin");
  if (path === "/api/me" && method === "GET") {
    const player = await currentPlayer(request, env);
    return json({
      player: player ? publicPlayer(player) : null,
      googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    });
  }
  if (path === "/api/auth/nonce" && method === "POST") {
    const nonce = token();
    return json({ nonce }, 200, {
      "Set-Cookie": setCookie("__Host-mindfkd-nonce", nonce, 600),
    });
  }
  if (path === "/api/auth/google" && method === "POST") {
    if (!env.GOOGLE_CLIENT_ID)
      fail(503, "Google sign-in is not configured yet");
    const input = await body(request),
      nonce = cookie(request, "__Host-mindfkd-nonce");
    if (!nonce || typeof input.credential !== "string")
      fail(400, "Start sign-in again");
    let sub: string;
    try {
      sub = await verifyGoogle(input.credential, env.GOOGLE_CLIENT_ID!, nonce!);
    } catch {
      return fail(401, "Google sign-in could not be verified. Try again.");
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO players (id,google_sub,display_name,created_at) VALUES (?,?,?,?) ON CONFLICT(google_sub) DO NOTHING",
    )
      .bind(id, sub, "Player", now)
      .run();
    const player = await env.DB.prepare(
      "SELECT id,username,display_name,bio,created_at FROM players WHERE google_sub=?",
    )
      .bind(sub)
      .first<Player>();
    if (!player) fail(503, "Account unavailable");
    const raw = token();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now),
      env.DB.prepare(
        "INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)",
      ).bind(await hash(raw), player!.id, now + 30 * 86400000),
    ]);
    const response = json({ player: publicPlayer(player!) }, 200, {
      "Set-Cookie": setCookie("__Host-mindfkd", raw, 30 * 86400),
    });
    response.headers.append(
      "Set-Cookie",
      setCookie("__Host-mindfkd-nonce", "", 0),
    );
    return response;
  }
  if (path === "/api/auth/logout" && method === "POST") {
    const raw = cookie(request, "__Host-mindfkd");
    if (raw)
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await hash(raw))
        .run();
    return json({ ok: true }, 200, {
      "Set-Cookie": setCookie("__Host-mindfkd", "", 0),
    });
  }
  if (path === "/api/profile" && method === "POST") {
    const p = await requirePlayer(request, env),
      input = await body(request);
    const username =
      typeof input.username === "string"
        ? input.username.toLowerCase().trim()
        : "";
    const displayName =
      typeof input.displayName === "string" ? input.displayName.trim() : "";
    const bio = typeof input.bio === "string" ? input.bio.trim() : "";
    if (
      !/^[a-z0-9_]{3,20}$/.test(username) ||
      ["admin", "support", "mindfkd", "api", "profile"].includes(username)
    )
      fail(400, "Use 3–20 letters, numbers or underscores for your username.");
    if (displayName.length < 1 || displayName.length > 32 || bio.length > 160)
      fail(400, "Name must be 1–32 characters; bio at most 160.");
    if (p.username && p.username !== username)
      fail(400, "Your username cannot change, so shared links keep working.");
    const existing = await env.DB.prepare(
      "SELECT id FROM players WHERE username=? AND id<>?",
    )
      .bind(username, p.id)
      .first();
    if (existing) fail(409, "That username is taken");
    try {
      await env.DB.prepare(
        "UPDATE players SET username=?,display_name=?,bio=? WHERE id=?",
      )
        .bind(username, displayName, bio, p.id)
        .run();
    } catch {
      return fail(409, "That username is taken");
    }
    return json({
      player: publicPlayer({ ...p, username, display_name: displayName, bio }),
    });
  }
  if (path === "/api/leaderboard" && method === "GET") {
    const p = await currentPlayer(request, env);
    const season = url.searchParams.get("season") ?? CURRENT_SEASON;
    if (!SEASONS.some((s) => s.id === season)) fail(400, "Unknown season");
    const top = await env.DB.prepare(
      leaderboardSQL + "SELECT * FROM ranked ORDER BY rank LIMIT 50",
    )
      .bind(season)
      .all();
    const me = p?.username
      ? await env.DB.prepare(
          leaderboardSQL + "SELECT * FROM ranked WHERE username=?",
        )
          .bind(season, p.username)
          .first()
      : null;
    return json({ players: top.results, me, season, seasons: SEASONS });
  }
  if (path === "/api/player" && method === "GET") {
    const username = url.searchParams.get("u")?.toLowerCase();
    if (!username) fail(400, "Missing username");
    const p = await env.DB.prepare(
      "SELECT id,username,display_name,bio,created_at FROM players WHERE username=?",
    )
      .bind(username)
      .first<Player>();
    if (!p) fail(404, "Player not found");
    const viewer = await currentPlayer(request, env);
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) AS games,COALESCE(MAX(score),0) AS bestScore,COALESCE(MAX(level),0) AS bestLevel,COALESCE(MAX(best_combo),0) AS bestCombo,COALESCE(SUM(correct),0) AS correct,COALESCE(SUM(incorrect),0) AS incorrect FROM runs WHERE player_id=? AND status='finished'",
    )
      .bind(p!.id)
      .first();
    const recent = await env.DB.prepare(
      "SELECT id,score,level,correct,incorrect,best_combo AS bestCombo,finished_at AS finishedAt FROM runs WHERE player_id=? AND status='finished' ORDER BY finished_at DESC LIMIT 10",
    )
      .bind(p!.id)
      .all();
    const following = await env.DB.prepare(
      "SELECT p.username,p.display_name FROM follows f JOIN players p ON p.id=f.following_id WHERE f.follower_id=? AND p.username IS NOT NULL ORDER BY f.created_at DESC LIMIT 50",
    )
      .bind(p!.id)
      .all();
    const counts = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM follows WHERE following_id=?) AS followers,(SELECT COUNT(*) FROM follows WHERE follower_id=?) AS following",
    )
      .bind(p!.id, p!.id)
      .first();
    const isFollowing = viewer
      ? !!(await env.DB.prepare(
          "SELECT 1 FROM follows WHERE follower_id=? AND following_id=?",
        )
          .bind(viewer.id, p!.id)
          .first())
      : false;
    const runId = url.searchParams.get("run");
    const sharedRun = runId
      ? await env.DB.prepare(
          "SELECT id,score,level,correct,incorrect,best_combo AS bestCombo,finished_at AS finishedAt FROM runs WHERE id=? AND player_id=? AND status='finished'",
        )
          .bind(runId, p!.id)
          .first()
      : null;
    return json({
      player: publicPlayer(p!),
      stats,
      recent: recent.results,
      following: following.results,
      counts,
      isFollowing,
      isMe: viewer?.id === p!.id,
      sharedRun,
    });
  }
  if (path === "/api/follow" && method === "POST") {
    const p = await requirePlayer(request, env);
    if (!p.username) fail(409, "Create your profile first");
    const input = await body(request);
    if (typeof input.username !== "string" || typeof input.follow !== "boolean")
      fail(400, "Invalid follow request");
    const target = await env.DB.prepare(
      "SELECT id FROM players WHERE username=?",
    )
      .bind(input.username)
      .first<{ id: string }>();
    if (!target || target.id === p.id) fail(400, "Invalid player");
    if (input.follow)
      await env.DB.prepare(
        "INSERT INTO follows(follower_id,following_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING",
      )
        .bind(p.id, target!.id, now)
        .run();
    else
      await env.DB.prepare(
        "DELETE FROM follows WHERE follower_id=? AND following_id=?",
      )
        .bind(p.id, target!.id)
        .run();
    return json({ ok: true });
  }
  if (path === "/api/runs/start" && method === "POST") {
    const p = await requirePlayer(request, env);
    if (!p.username) fail(409, "Create your profile first");
    const [count, history] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM runs WHERE player_id=? AND created_at>?",
      )
        .bind(p.id, now - 3600000)
        .first<{ n: number }>(),
      questionHistory(env, p.id),
    ]);
    if ((count?.n ?? 0) >= 120)
      fail(429, "Too many runs. Take a break and try again later.");
    const id = crypto.randomUUID(),
      state = newRanked(
        crypto.getRandomValues(new Uint32Array(1))[0],
        now,
        history,
      );
    const q = state.run.question!;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO runs(id,player_id,state,status,created_at,season,bank_version) VALUES(?,?,?,'active',?,?,?)",
      ).bind(
        id,
        p.id,
        JSON.stringify(state),
        now,
        CURRENT_SEASON,
        BANK_VERSION,
      ),
      env.DB.prepare(
        "INSERT INTO question_events(run_id,question_id,topic_key,player_id,bank_version,difficulty,shown_at) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        id,
        q.id,
        q.topicKey ?? q.id,
        p.id,
        BANK_VERSION,
        q.difficulty,
        now,
      ),
    ]);
    return json(publicRun(state, Date.now(), id, 0));
  }
  if (
    ["/api/runs/answer", "/api/runs/next", "/api/runs/finish"].includes(path) &&
    method === "POST"
  ) {
    const input = await body(request);
    const sessionToken = cookie(request, "__Host-mindfkd");
    if (!sessionToken) fail(401, "Sign in to continue");
    if (typeof input.id !== "string" || !Number.isInteger(input.version))
      fail(400, "Invalid run");
    const row = await env.DB.prepare(
      "SELECT r.state,r.version,r.status,r.bank_version,r.player_id FROM runs r JOIN sessions s ON s.player_id=r.player_id WHERE r.id=? AND s.token_hash=? AND s.expires_at>?",
    )
      .bind(input.id, await hash(sessionToken!), now)
      .first<{
        state: string;
        version: number;
        status: string;
        bank_version: string;
        player_id: string;
      }>();
    if (!row) {
      // Only unsuccessful lookups need a second query to distinguish expiry from ownership.
      await requirePlayer(request, env);
      fail(404, "Run not found");
    }
    const p = { id: row!.player_id };
    const state = JSON.parse(row!.state) as RankedState;
    if (row!.status === "finished" || row!.version !== input.version)
      return json(publicRun(state, Date.now(), input.id, row!.version));
    let next = state;
    if (path.endsWith("/answer")) {
      if (!(
        typeof input.answer === "string" ||
        (Array.isArray(input.answer) &&
          input.answer.length <= 6 &&
          input.answer.every((a: unknown) => typeof a === "string"))
      ))
        fail(400, "Invalid answer");
      next = answerRanked(state, input.answer, now);
    } else if (path.endsWith("/next")) {
      // A run started before a bank update keeps its recorded score but cannot mix pools.
      if (row!.bank_version !== BANK_VERSION)
        next = {
          ...state,
          run: { ...state.run, phase: "gameOver", reason: "bank" },
        };
      else next = advanceRanked(state, now, await questionHistory(env, p.id));
    } else if (now >= state.run.deadline)
      next = {
        ...state,
        run: { ...state.run, phase: "gameOver", reason: "time" },
      };
    if (next === state)
      return json(publicRun(state, Date.now(), input.id, row!.version));
    const r = next.run,
      finished = r.phase === "gameOver";
    const serialized = JSON.stringify(next);
    const update = env.DB.prepare(
      "UPDATE runs SET state=?,version=version+1,status=?,score=?,level=?,correct=?,incorrect=?,best_combo=?,finished_at=? WHERE id=? AND player_id=? AND version=?",
    ).bind(
      serialized,
      finished ? "finished" : "active",
      r.score,
      r.level,
      r.correct,
      r.incorrect,
      r.bestCombo,
      finished ? now : null,
      input.id,
      p.id,
      row!.version,
    );
    const statements = [update];
    const q = r.question;
    // Both writes share the same transaction. State/version guard prevents a losing
    // concurrent request from recording an answer or exposure that was not accepted.
    if (q && q.id !== state.run.question?.id) {
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO question_events(run_id,question_id,topic_key,player_id,bank_version,difficulty,shown_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND version=? AND state=?)",
        ).bind(
          input.id,
          q.id,
          q.topicKey ?? q.id,
          p.id,
          row!.bank_version,
          q.difficulty,
          now,
          input.id,
          row!.version + 1,
          serialized,
        ),
      );
    }
    if (
      path.endsWith("/answer") &&
      state.run.phase === "playing" &&
      r.feedback &&
      q
    ) {
      statements.push(
        env.DB.prepare(
          "UPDATE question_events SET answered_at=?,elapsed_ms=?,correct=? WHERE run_id=? AND question_id=? AND answered_at IS NULL AND EXISTS(SELECT 1 FROM runs WHERE id=? AND version=? AND state=?)",
        ).bind(
          now,
          Math.max(0, now - state.run.questionStartedAt),
          Number(r.feedback.correct),
          input.id,
          q.id,
          input.id,
          row!.version + 1,
          serialized,
        ),
      );
    }
    const [result] = await env.DB.batch(statements);
    if (!result.meta.changes) fail(409, "Run updated. Retry your request.");
    return json(publicRun(next, Date.now(), input.id, row!.version + 1));
  }
  return fail(404, "Not found");
}
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      console.error(
        "MINDFKD request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return json({ error: "Service unavailable. Please try again." }, 503);
    }
  },
};

export default worker;
