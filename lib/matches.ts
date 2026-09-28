import type { Question } from "./game";
import type { Genre } from "./genres";
export const MATCH_RULES = {
  rounds: 10,
  answerMs: 10000,
  revealMs: 2000,
  countdownMs: 5000,
  maxTeamSize: 50,
  lobbyMs: 30 * 60 * 1000,
} as const;
export const matchDuration =
  MATCH_RULES.rounds * (MATCH_RULES.answerMs + MATCH_RULES.revealMs);
export function matchClock(startAt: number | null, now: number) {
  if (startAt === null)
    return { phase: "waiting" as const, round: 0, deadline: 0 };
  if (now < startAt)
    return { phase: "countdown" as const, round: 0, deadline: startAt };
  const elapsed = now - startAt,
    round = Math.floor(elapsed / (MATCH_RULES.answerMs + MATCH_RULES.revealMs));
  if (round >= MATCH_RULES.rounds)
    return {
      phase: "finished" as const,
      round: MATCH_RULES.rounds,
      deadline: startAt + matchDuration,
    };
  const start = startAt + round * (MATCH_RULES.answerMs + MATCH_RULES.revealMs);
  return now < start + MATCH_RULES.answerMs
    ? {
        phase: "question" as const,
        round,
        deadline: start + MATCH_RULES.answerMs,
      }
    : {
        phase: "reveal" as const,
        round,
        deadline: start + MATCH_RULES.answerMs + MATCH_RULES.revealMs,
      };
}
export type MatchView = {
  code: string;
  mode: "duel" | "teams";
  genre: Genre;
  status: string;
  serverNow: number;
  startAt: number | null;
  endAt: number | null;
  isHost: boolean;
  joined: boolean;
  winnerTeam: number | null;
  clock: ReturnType<typeof matchClock>;
  question: Question | null;
  answered: boolean;
  selected: string | string[] | null;
  correct: boolean | null;
  points: number;
  members: {
    username: string;
    displayName: string;
    team: number;
    ready: boolean;
    isMe: boolean;
    score: number;
    correct: number;
    wrong: number;
    unanswered: number;
    answered: boolean;
  }[];
  teams: { team: number; players: number; total: number; score: number }[];
  rules: typeof MATCH_RULES;
};
