import type { Env, Player } from "./types";
import { questions } from "../data/questions";
import { isGenre, type Genre } from "../lib/genres";
import {
  questionsForGenre,
  seededRandom,
  selectQuestion,
  type Question,
} from "../lib/game";
import {
  MATCH_RULES,
  matchDuration,
  matchClock,
  type MatchView,
} from "../lib/matches";
import { currentPlayer } from "./auth";

type StoredMember = {
  id: string;
  username: string;
  displayName: string;
  team: number;
  ready: number;
};
type StoredAnswer = {
  player: string;
  round: number;
  score: number;
  correct: number;
  answer: string;
};
type Room = {
  code: string;
  host_id: string;
  mode: "duel" | "teams";
  genre: Genre;
  status: string;
  questions: string;
  created_at: number;
  start_at: number | null;
  end_at: number | null;
  winner_team: number | null;
  members: string;
  answers: string;
};
export class MatchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new MatchError(status, message);
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
function codeOf(value: unknown) {
  if (typeof value !== "string" || !/^[A-Fa-f0-9]{12}$/.test(value))
    fail(400, "Enter a valid room code");
  return value.toUpperCase();
}
export function buildMatchQuestions(genre: Genre, seed: number): Question[] {
  const bank = questionsForGenre(questions, genre),
    rng = seededRandom(seed),
    used: string[] = [],
    deck: Question[] = [];
  for (const level of [1, 1, 1, 6, 6, 6, 11, 11, 16, 16]) {
    const q = selectQuestion(bank, level, used, rng);
    if (!q) fail(503, "Not enough questions for this category");
    deck.push(q);
    used.push(q.id);
  }
  return deck;
}
async function readRoom(env: Env, code: string): Promise<Room> {
  const r = await env.DB.prepare(
    `SELECT r.*,
 (SELECT json_group_array(json_object('id',p.id,'username',p.username,'displayName',p.display_name,'team',m.team,'ready',m.ready)) FROM match_members m JOIN players p ON p.id=m.player_id WHERE m.code=r.code) AS members,
 (SELECT json_group_array(json_object('player',a.player_id,'round',a.round,'score',a.score,'correct',a.correct,'answer',a.answer)) FROM match_answers a WHERE a.code=r.code) AS answers
 FROM matches r WHERE r.code=?`,
  )
    .bind(code)
    .first<Room>();
  if (!r) fail(404, "Room not found");
  return r;
}
function parsed(r: Room) {
  return {
    members: JSON.parse(r.members) as StoredMember[],
    answers: JSON.parse(r.answers) as StoredAnswer[],
    deck: JSON.parse(r.questions) as Question[],
  };
}
function teamsOf(members: StoredMember[], answers: StoredAnswer[]) {
  return [1, 2].map((team) => {
    const ids = new Set(
      members.filter((m) => m.team === team).map((m) => m.id),
    );
    const total = answers
      .filter((a) => ids.has(a.player))
      .reduce((n, a) => n + a.score, 0);
    return { team, players: ids.size, total, score: total };
  });
}
export function matchWinner(members: StoredMember[], answers: StoredAnswer[]) {
  const [a, b] = teamsOf(members, answers);
  const delta = a.total - b.total;
  return delta === 0 ? 0 : delta > 0 ? 1 : 2;
}
async function settle(env: Env, r: Room, now: number) {
  if (r.status === "waiting" && now - r.created_at > MATCH_RULES.lobbyMs) {
    await env.DB.prepare(
      "UPDATE matches SET status='cancelled' WHERE code=? AND status='waiting'",
    )
      .bind(r.code)
      .run();
    return { ...r, status: "cancelled" };
  }
  if (r.status !== "active" || !r.end_at || now < r.end_at) return r;
  // Calculate the winner in the same write that closes submissions. An answer
  // committed before this statement is counted; later submissions cannot insert.
  const total = (team: number) =>
    `COALESCE((SELECT SUM(a.score) FROM match_answers a JOIN match_members m ON m.code=a.code AND m.player_id=a.player_id WHERE a.code=matches.code AND m.team=${team}),0)`;
  await env.DB.prepare(
    `UPDATE matches SET status='finished',winner_team=CASE WHEN ${total(1)}>${total(2)} THEN 1 WHEN ${total(2)}>${total(1)} THEN 2 ELSE 0 END,finished_at=? WHERE code=? AND status='active' AND end_at<=?`,
  )
    .bind(now, r.code, now)
    .run();
  return await readRoom(env, r.code);
}
export function matchView(r: Room, playerId: string, now: number): MatchView {
  const { members, answers, deck } = parsed(r),
    clock = matchClock(r.start_at, now),
    me = members.find((m) => m.id === playerId);
  if (r.status !== "waiting" && !me)
    fail(403, "Only room members can view this match");
  const visible = answers.filter(
    (a) =>
      r.status === "finished" ||
      a.round < clock.round ||
      (clock.phase === "reveal" && a.round === clock.round),
  );
  const mine = answers.find(
    (a) => a.player === playerId && a.round === clock.round,
  );
  const reveal = clock.phase === "reveal";
  const q = clock.phase === "question" || reveal ? deck[clock.round] : null;
  return {
    code: r.code,
    mode: r.mode,
    genre: r.genre,
    status: r.status,
    serverNow: now,
    startAt: r.start_at,
    endAt: r.end_at,
    isHost: r.host_id === playerId,
    joined: !!me,
    winnerTeam: r.winner_team,
    clock,
    question: q
      ? {
          ...q,
          answer: reveal ? q.answer : "",
          explanation: reveal ? q.explanation : undefined,
        }
      : null,
    answered: !!mine,
    selected: mine ? JSON.parse(mine.answer) : null,
    correct: reveal && mine ? !!mine.correct : null,
    points: reveal && mine ? mine.score : 0,
    members: members.map((m) => ({
      username: m.username,
      displayName: m.displayName,
      team: m.team,
      ready: !!m.ready,
      isMe: m.id === playerId,
      score: visible
        .filter((a) => a.player === m.id)
        .reduce((n, a) => n + a.score, 0),
      correct: visible.filter((a) => a.player === m.id && a.correct === 1)
        .length,
      wrong: visible.filter((a) => a.player === m.id && a.correct === 0).length,
      unanswered: Math.max(
        0,
        (r.status === "finished"
          ? MATCH_RULES.rounds
          : clock.round + (clock.phase === "reveal" ? 1 : 0)) -
          visible.filter((a) => a.player === m.id).length,
      ),
      answered: answers.some(
        (a) => a.player === m.id && a.round === clock.round,
      ),
    })),
    teams: teamsOf(members, visible),
    rules: MATCH_RULES,
  };
}
export async function competitionStats(env: Env, playerId: string) {
  // Expired games settle on reconnect/profile reads too, even if everybody closed the tab.
  const pending = await env.DB.prepare(
    "SELECT r.code FROM matches r JOIN match_members m ON m.code=r.code WHERE m.player_id=? AND r.status='active' AND r.end_at<=? LIMIT 30",
  )
    .bind(playerId, Date.now())
    .all<{ code: string }>();
  for (const r of pending.results)
    await settle(env, await readRoom(env, r.code), Date.now());
  return await env.DB.prepare(
    `SELECT
 COALESCE(SUM(CASE WHEN r.mode='duel' AND r.winner_team=m.team THEN 1 ELSE 0 END),0) AS wins,
 COALESCE(SUM(CASE WHEN r.mode='duel' AND r.winner_team<>0 AND r.winner_team<>m.team THEN 1 ELSE 0 END),0) AS losses,
 COALESCE(SUM(CASE WHEN r.mode='duel' AND r.winner_team=0 THEN 1 ELSE 0 END),0) AS draws,
 COALESCE(SUM(CASE WHEN r.mode='teams' AND r.winner_team=m.team THEN 1 ELSE 0 END),0) AS teamWins,
 COALESCE(SUM(CASE WHEN r.mode='teams' AND r.winner_team<>0 AND r.winner_team<>m.team THEN 1 ELSE 0 END),0) AS teamLosses
 FROM match_members m JOIN matches r ON r.code=m.code WHERE m.player_id=? AND r.status='finished'`,
  )
    .bind(playerId)
    .first();
}
export async function matchAPI(
  request: Request,
  env: Env,
  player: Player,
  input: Record<string, unknown> = {},
): Promise<Response> {
  if (!player.username) fail(409, "Create your profile to compete");
  const url = new URL(request.url),
    action = url.pathname.split("/").pop(),
    now = Date.now();
  if (action === "create" && request.method === "POST") {
    const genre = input.genre ?? "mixed",
      mode = input.mode ?? "duel";
    if (!isGenre(genre) || (mode !== "duel" && mode !== "teams"))
      fail(400, "Invalid match options");
    const code = crypto
        .randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase(),
      deck = buildMatchQuestions(
        genre,
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
    const [created] = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO matches(code,host_id,mode,genre,questions,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM matches WHERE host_id=? AND created_at>?)<20",
      ).bind(
        code,
        player.id,
        mode,
        genre,
        JSON.stringify(deck),
        now,
        player.id,
        now - 3600000,
      ),
      env.DB.prepare(
        "INSERT INTO match_members(code,player_id,team,joined_at) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM matches WHERE code=?)",
      ).bind(code, player.id, now, code),
    ]);
    if (!created.meta.changes) fail(429, "Room limit reached. Try again later");
    return json(matchView(await readRoom(env, code), player.id, Date.now()));
  }
  const code = codeOf(
    request.method === "GET" ? url.searchParams.get("code") : input.code,
  );
  if (action === "stream" && request.method === "GET") {
    // SSE is server push; D1 remains the cross-worker authority. Bounded streams
    // reconnect automatically and avoid relying on per-isolate memory for rooms.
    const initial = await settle(env, await readRoom(env, code), now);
    matchView(initial, player.id, now);
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const began = Date.now();
        let last = "",
          lastAuth = began;
        const tick = async () => {
          if (cancelled) return;
          try {
            if (Date.now() - lastAuth > 5000) {
              if (!(await currentPlayer(request, env)))
                throw Error("session ended");
              lastAuth = Date.now();
            }
            const room = await settle(
                env,
                await readRoom(env, code),
                Date.now(),
              ),
              view = matchView(room, player.id, Date.now());
            const signature = JSON.stringify({ ...view, serverNow: 0 });
            if (signature !== last) {
              controller.enqueue(
                encoder.encode(
                  `event: state\ndata: ${JSON.stringify(view)}\n\n`,
                ),
              );
              last = signature;
            } else
              controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
            if (
              Date.now() - began > 15000 ||
              ["finished", "cancelled"].includes(room.status)
            ) {
              cancelled = true;
              controller.close();
              return;
            }
            timer = setTimeout(() => void tick(), 500);
          } catch {
            if (!cancelled) {
              cancelled = true;
              controller.close();
            }
          }
        };
        controller.enqueue(encoder.encode("retry: 250\n\n"));
        void tick();
      },
      cancel() {
        cancelled = true;
        if (timer) clearTimeout(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  }
  let room = await settle(env, await readRoom(env, code), now);
  if (request.method === "GET" && action === "room")
    return json(matchView(room, player.id, Date.now()));
  if (request.method !== "POST") fail(404, "Not found");
  const { members, deck } = parsed(room),
    me = members.find((m) => m.id === player.id);
  if (action === "join") {
    if (me && room.status !== "waiting")
      return json(matchView(room, player.id, Date.now()));
    const team = input.team;
    if (team !== 1 && team !== 2) fail(400, "Choose team 1 or 2");
    const limit = room.mode === "duel" ? 1 : MATCH_RULES.maxTeamSize;
    const result = await env.DB.prepare(
      `INSERT INTO match_members(code,player_id,team,joined_at)
   SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM matches WHERE code=? AND status='waiting' AND created_at>?)
    AND (SELECT COUNT(*) FROM match_members WHERE code=? AND team=? AND player_id<>?)<?
   ON CONFLICT(code,player_id) DO UPDATE SET team=excluded.team,ready=0`,
    )
      .bind(
        code,
        player.id,
        team,
        now,
        code,
        now - MATCH_RULES.lobbyMs,
        code,
        team,
        player.id,
        limit,
      )
      .run();
    if (!result.meta.changes)
      fail(409, "That team is full or the match has already started");
  } else {
    if (!me) fail(403, "Join a team first");
    if (action === "ready") {
      if (typeof input.ready !== "boolean") fail(400, "Invalid readiness");
      const result = await env.DB.prepare(
        "UPDATE match_members SET ready=? WHERE code=? AND player_id=? AND EXISTS(SELECT 1 FROM matches WHERE code=? AND status='waiting')",
      )
        .bind(Number(input.ready), code, player.id, code)
        .run();
      if (!result.meta.changes) fail(409, "Match already started");
    } else if (action === "start") {
      if (room.host_id !== player.id) fail(403, "Only the host can start");
      const start = now + MATCH_RULES.countdownMs;
      const result = await env.DB.prepare(
        `UPDATE matches SET status='active',start_at=?,end_at=? WHERE code=? AND host_id=? AND status='waiting'
    AND (SELECT COUNT(*) FROM match_members WHERE code=? AND team=1)>0
    AND (SELECT COUNT(*) FROM match_members WHERE code=? AND team=2)>0
    AND NOT EXISTS(SELECT 1 FROM match_members WHERE code=? AND ready=0)`,
      )
        .bind(start, start + matchDuration, code, player.id, code, code, code)
        .run();
      if (!result.meta.changes)
        fail(409, "Both teams need players and everyone must be ready");
    } else if (action === "leave") {
      if (room.status !== "waiting")
        fail(
          409,
          "An active match cannot be left or switched. Unanswered rounds score zero.",
        );
      if (room.host_id === player.id)
        await env.DB.prepare(
          "UPDATE matches SET status='cancelled' WHERE code=? AND status='waiting'",
        )
          .bind(code)
          .run();
      else
        await env.DB.prepare(
          "DELETE FROM match_members WHERE code=? AND player_id=? AND EXISTS(SELECT 1 FROM matches WHERE code=? AND status='waiting')",
        )
          .bind(code, player.id, code)
          .run();
      return json({ left: true });
    } else if (action === "answer") {
      const clock = matchClock(room.start_at, now);
      if (
        room.status !== "active" ||
        clock.phase !== "question" ||
        input.round !== clock.round
      )
        fail(409, "This question has closed");
      const q = deck[clock.round],
        answer = input.answer;
      const valid =
        q.type === "order"
          ? Array.isArray(answer) &&
            answer.length === q.options.length &&
            new Set(answer).size === answer.length &&
            answer.every((a) => typeof a === "string" && q.options.includes(a))
          : typeof answer === "string" && q.options.includes(answer);
      if (!valid) fail(400, "Choose a valid answer");
      const correct = JSON.stringify(answer) === JSON.stringify(q.answer);
      // Fixed correct-answer points: latency never changes the points awarded.
      const score = correct ? 100 * q.difficulty : 0;
      await env.DB.prepare(
        `INSERT INTO match_answers(code,player_id,round,answer,correct,score,answered_at)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM matches r JOIN match_members m ON m.code=r.code WHERE r.code=? AND r.status='active' AND m.player_id=? AND r.end_at>?)
    ON CONFLICT(code,player_id,round) DO NOTHING`,
      )
        .bind(
          code,
          player.id,
          clock.round,
          JSON.stringify(answer),
          Number(correct),
          score,
          now,
          code,
          player.id,
          now,
        )
        .run();
    } else fail(404, "Not found");
  }
  room = await settle(env, await readRoom(env, code), Date.now());
  return json(matchView(room, player.id, Date.now()));
}
