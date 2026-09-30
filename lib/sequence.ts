import {
  type Question,
  type Run,
  startRun,
  nextQuestion,
  seededRandom,
  selectQuestion,
} from "./game";
import { RULES } from "./rules";
import type { RankedState } from "../server/ranked";
export function makeSequence(
  bank: Question[],
  seed: number,
  count = RULES.sequenceLength,
) {
  const rng = seededRandom(seed),
    deck: Question[] = [],
    used: string[] = [];
  for (let level = 1; level <= count; level++) {
    const q = selectQuestion(bank, level, used, rng);
    if (!q)
      throw new Error(
        `Not enough reviewed questions for difficulty at level ${level}`,
      );
    deck.push(q);
    used.push(q.id);
  }
  return deck;
}
export function startSequence(deck: Question[], now: number): RankedState {
  const run = startRun([deck[0]], seededRandom(1), now);
  return {
    run: { ...run, question: deck[0] },
    readyAt: 0,
    seed: 1,
    genre: "mixed",
  };
}
export function advanceSequence(
  state: RankedState,
  deck: Question[],
  now: number,
): RankedState {
  const r = state.run;
  if (now >= r.deadline)
    return { ...state, run: { ...r, phase: "gameOver", reason: "time" } };
  if (r.phase !== "feedback" || now < state.readyAt) return state;
  if (r.level >= deck.length)
    return { ...state, run: { ...r, phase: "gameOver", reason: "bank" } };
  const q = deck[r.level];
  const next = nextQuestion(r, [q], seededRandom(1), now);
  return { ...state, run: { ...next, question: q } };
}
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export const dailyNumber = (date: string) =>
  Math.floor(
    (Date.parse(date + "T00:00:00Z") - Date.UTC(2026, 8, 30)) / 86400000,
  ) + 1;
export function resultSummary(run: Run, times: number[]) {
  const answered = run.correct + run.incorrect;
  return {
    score: run.score,
    level: run.level,
    correct: run.correct,
    incorrect: run.incorrect,
    bestCombo: run.bestCombo,
    accuracy: answered ? Math.round((100 * run.correct) / answered) : 0,
    averageResponseMs: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0,
  };
}
export type SequenceResult = ReturnType<typeof resultSummary>;
