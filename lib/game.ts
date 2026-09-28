import { type Genre, categoryGenre } from "./genres";
export type Kind =
  "choice" | "binary" | "higher" | "order" | "boolean" | "number" | "visual";
export type Question = {
  id: string;
  difficulty: number;
  category: string;
  type: Kind;
  prompt: string;
  options: string[];
  answer: string | string[];
  explanation?: string;
  topicKey?: string;
  source?: string;
  genre?: Genre;
};
export const config = {
  startMs: 30000,
  bonusMs: 4000,
  penaltyMs: 6000,
  correctFeedbackMs: 520,
  wrongFeedbackMs: 850,
};
export const difficultyFor = (level: number) =>
  level <= 20 ? Math.ceil(level / 5) : level <= 30 ? 5 : level <= 40 ? 6 : 7;
export const multiplier = (combo: number) =>
  combo >= 15 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1.5 : combo >= 3 ? 1.2 : 1;
export function scoreAnswer(
  difficulty: number,
  elapsedMs: number,
  combo: number,
) {
  return Math.round(
    (difficulty * 150 + Math.max(0, 300 - Math.floor(elapsedMs / 10))) *
      multiplier(combo),
  );
}
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export type QuestionHistory = Record<string, number>;
const indexes = new WeakMap<
  Question[],
  { byId: Map<string, Question>; tiers: Map<number, Question[]> }
>();
function bankIndex(bank: Question[]) {
  let index = indexes.get(bank);
  if (!index) {
    const tiers = new Map<number, Question[]>();
    for (const q of bank) {
      const rows = tiers.get(q.difficulty) ?? [];
      rows.push(q);
      tiers.set(q.difficulty, rows);
    }
    index = { byId: new Map(bank.map((q) => [q.id, q])), tiers };
    indexes.set(bank, index);
  }
  return index;
}
const genrePools = new WeakMap<Question[], Map<Genre, Question[]>>();
export function questionsForGenre(bank: Question[], genre: Genre) {
  if (genre === "mixed") return bank;
  let pools = genrePools.get(bank);
  if (!pools) {
    pools = new Map();
    genrePools.set(bank, pools);
  }
  if (!pools.has(genre))
    pools.set(
      genre,
      bank.filter((q) => (q.genre ?? categoryGenre(q.category)) === genre),
    );
  return pools.get(genre)!;
}
export function selectQuestion(
  bank: Question[],
  level: number,
  used: string[],
  random: () => number,
  history: QuestionHistory = {},
): Question | null {
  const { byId, tiers } = bankIndex(bank);
  const group = (q: Question) => q.topicKey ?? q.id;
  const usedGroups = new Set(
    used
      .map((id) => byId.get(id))
      .filter((q): q is Question => !!q)
      .map(group),
  );
  // Never jump difficulty or repeat a fact in the same run.
  const available = (tiers.get(difficultyFor(level)) ?? []).filter(
    (q) => !usedGroups.has(group(q)),
  );
  if (!available.length) return null;
  const lastSeen = (q: Question) => history[group(q)] ?? 0;
  const unseen = available.filter((q) => !lastSeen(q));
  const oldest = Math.min(...available.map(lastSeen));
  let pool = unseen.length
    ? unseen
    : available.filter((q) => lastSeen(q) === oldest);
  const recentCategories = used.slice(-2).map((id) => byId.get(id)?.category);
  const varied = pool.filter((q) => !recentCategories.includes(q.category));
  if (varied.length) pool = varied;
  const q = pool[Math.floor(random() * pool.length)];
  return {
    ...q,
    options:
      q.type === "higher" || q.type === "boolean" || q.type === "number"
        ? q.options
        : shuffle(q.options, random),
  };
}
export type Phase = "idle" | "playing" | "feedback" | "gameOver";
export type Run = {
  phase: Phase;
  deadline: number;
  level: number;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  incorrect: number;
  question: Question | null;
  used: string[];
  questionStartedAt: number;
  feedback: null | {
    correct: boolean;
    points: number;
    selected: string | string[];
    responseTimeMs?: number;
    timeBeforeMs?: number;
    timeAfterMs?: number;
  };
  reason?: "time" | "bank";
};
export const emptyRun: Run = {
  phase: "idle",
  deadline: 0,
  level: 1,
  score: 0,
  combo: 0,
  bestCombo: 0,
  correct: 0,
  incorrect: 0,
  question: null,
  used: [],
  questionStartedAt: 0,
  feedback: null,
};
export function startRun(
  bank: Question[],
  random: () => number,
  now: number,
  level = 1,
  history: QuestionHistory = {},
): Run {
  const question = selectQuestion(bank, level, [], random, history);
  return {
    ...emptyRun,
    phase: question ? "playing" : "gameOver",
    reason: question ? undefined : "bank",
    deadline: now + config.startMs,
    questionStartedAt: now,
    question,
    used: question ? [question.id] : [],
    level,
  };
}
export function answerRun(
  run: Run,
  answer: string | string[],
  now: number,
): Run {
  if (run.phase !== "playing" || !run.question) return run;
  if (now >= run.deadline) return { ...run, phase: "gameOver", reason: "time" };
  const correct =
    JSON.stringify(answer) === JSON.stringify(run.question.answer);
  const combo = correct ? run.combo + 1 : 0;
  const points = correct
    ? scoreAnswer(run.question.difficulty, now - run.questionStartedAt, combo)
    : 0;
  return {
    ...run,
    phase: "feedback",
    deadline: run.deadline + (correct ? config.bonusMs : -config.penaltyMs),
    score: run.score + points,
    combo,
    bestCombo: Math.max(combo, run.bestCombo),
    correct: run.correct + Number(correct),
    incorrect: run.incorrect + Number(!correct),
    feedback: {
      correct,
      points,
      selected: answer,
      responseTimeMs: Math.max(0, now - run.questionStartedAt),
      timeBeforeMs: Math.max(0, run.deadline - now),
      timeAfterMs: Math.max(
        0,
        run.deadline - now + (correct ? config.bonusMs : -config.penaltyMs),
      ),
    },
  };
}
export function nextQuestion(
  run: Run,
  bank: Question[],
  random: () => number,
  now: number,
  history: QuestionHistory = {},
): Run {
  if (now >= run.deadline) return { ...run, phase: "gameOver", reason: "time" };
  const level = run.level + 1,
    question = selectQuestion(bank, level, run.used, random, history);
  if (!question) return { ...run, phase: "gameOver", reason: "bank" };
  return {
    ...run,
    phase: "playing",
    question,
    level,
    used: [...run.used, question.id],
    questionStartedAt: now,
    feedback: null,
  };
}
