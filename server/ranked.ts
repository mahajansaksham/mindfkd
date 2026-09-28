import { type Genre } from "../lib/genres";
import { questions } from "../data/questions";
import {
  Run,
  QuestionHistory,
  startRun,
  answerRun,
  nextQuestion,
  seededRandom,
  config,
  questionsForGenre,
} from "../lib/game";
export type RankedState = {
  run: Run;
  seed: number;
  readyAt: number;
  genre?: Genre;
};
export function newRanked(
  seed: number,
  now: number,
  history: QuestionHistory = {},
  genre: Genre = "mixed",
): RankedState {
  return {
    run: startRun(
      questionsForGenre(questions, genre),
      seededRandom(seed),
      now,
      1,
      history,
    ),
    seed,
    genre,
    readyAt: 0,
  };
}
export function answerRanked(
  state: RankedState,
  answer: string | string[],
  now: number,
): RankedState {
  if (state.run.phase !== "playing") return state;
  const run = answerRun(state.run, answer, now);
  if (run.deadline <= now) run.phase = "gameOver";
  return {
    ...state,
    run,
    readyAt:
      now +
      (run.feedback?.correct
        ? config.correctFeedbackMs
        : config.wrongFeedbackMs),
  };
}
export function advanceRanked(
  state: RankedState,
  now: number,
  history: QuestionHistory = {},
): RankedState {
  if (now >= state.run.deadline)
    return {
      ...state,
      run: { ...state.run, phase: "gameOver", reason: "time" },
    };
  if (state.run.phase !== "feedback" || now < state.readyAt) return state;
  return {
    ...state,
    run: nextQuestion(
      state.run,
      questionsForGenre(questions, state.genre ?? "mixed"),
      seededRandom(state.seed + state.run.level),
      now,
      history,
    ),
  };
}
export function publicRun(
  state: RankedState,
  now: number,
  id: string,
  version: number,
) {
  const r = state.run;
  return {
    id,
    genre: state.genre ?? "mixed",
    version,
    remainingMs: Math.max(0, r.deadline - now),
    waitMs: Math.max(0, state.readyAt - now),
    run: {
      ...r,
      used: [],
      deadline: 0,
      questionStartedAt: 0,
      question: r.question
        ? {
            ...r.question,
            answer: r.feedback ? r.question.answer : "",
            explanation: r.feedback ? r.question.explanation : undefined,
          }
        : null,
    },
  };
}
