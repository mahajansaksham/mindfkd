import { test } from "node:test";
import assert from "node:assert/strict";
import { questions } from "../data/questions";
import {
  startRun,
  answerRun,
  nextQuestion,
  seededRandom,
  difficultyFor,
  multiplier,
  scoreAnswer,
  selectQuestion,
} from "../lib/game";
import { accumulate, blankStats } from "../lib/storage";
import { shareText } from "../lib/share";
test("bank integrity and coverage", () => {
  assert.ok(questions.length >= 150);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(new Set(questions.map((q) => q.prompt)).size, questions.length);
  for (let tier = 1; tier <= 7; tier++) {
    const pool = questions.filter((q) => q.difficulty === tier);
    assert.ok(pool.length >= 20);
    assert.equal(new Set(pool.map((q) => q.type)).size, 7);
  }
  for (const q of questions) {
    assert.ok(q.prompt && q.category);
    for (const a of Array.isArray(q.answer) ? q.answer : [q.answer])
      assert.ok(q.options.includes(a));
    assert.equal(new Set(q.options).size, q.options.length);
  }
});
test("timer bonus, penalty, combo, speed and rapid taps", () => {
  const rng = seededRandom(42);
  const r = startRun(questions, rng, 100);
  assert.equal(r.deadline, 30100);
  const right = answerRun(r, r.question!.answer, 1100);
  assert.equal(right.deadline, 34100);
  assert.equal(right.combo, 1);
  assert.equal(right.score, 350);
  assert.equal(answerRun(right, r.question!.answer, 1101), right);
  const next = nextQuestion(right, questions, rng, 1620);
  const wrong = answerRun(next, "invalid", 1700);
  assert.equal(wrong.deadline, 28100);
  assert.equal(wrong.combo, 0);
  assert.equal(wrong.incorrect, 1);
  assert.equal(wrong.bestCombo, 1);
  assert.equal(answerRun(r, r.question!.answer, 30100).phase, "gameOver");
  assert.equal(nextQuestion(wrong, questions, rng, 100000).phase, "gameOver");
});
test("scoring thresholds and level boundaries", () => {
  assert.deepEqual([1, 3, 5, 10, 15].map(multiplier), [1, 1.2, 1.5, 2, 3]);
  assert.deepEqual(
    [1, 5, 6, 10, 11, 15, 16, 20, 21, 30, 31, 40, 41].map(difficultyFor),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7],
  );
  assert.equal(scoreAnswer(7, 0, 15), 4050);
  assert.equal(scoreAnswer(7, 10000, 0), 1050);
});
test("seed reproducibility, shuffle, no repeats, exhaustion", () => {
  const a = seededRandom(9),
    b = seededRandom(9),
    used: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = selectQuestion(questions, i + 1, used, a)!;
    assert.deepEqual(q, selectQuestion(questions, i + 1, used, b));
    assert.ok(!used.includes(q.id));
    used.push(q.id);
  }
  assert.equal(selectQuestion(questions, 200, used, a), null);
});
test("stats aggregate and share without answers", () => {
  let r = startRun(questions, seededRandom(8), 0);
  r = { ...r, score: 1000, level: 5, correct: 3, incorrect: 1, bestCombo: 3 };
  const s = accumulate(blankStats, r);
  assert.equal(s.gamesPlayed, 1);
  assert.equal(s.averageAccuracy, 75);
  assert.deepEqual(s.recentScores, [1000]);
  assert.equal(accumulate(s, r).gamesPlayed, 2);
  assert.match(shareText(r), /🎯 3\/4/);
  assert.ok(!shareText(r).includes(r.question!.prompt));
});
