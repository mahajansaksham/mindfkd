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
  assert.ok(questions.length >= 1000);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(new Set(questions.map((q) => q.prompt)).size, questions.length);
  for (let tier = 1; tier <= 7; tier++) {
    const pool = questions.filter((q) => q.difficulty === tier);
    assert.ok(pool.length >= 20);
    assert.ok(pool.length >= 20);
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
    const q = selectQuestion(questions, 41, used, a);
    assert.deepEqual(q, selectQuestion(questions, 41, used, b));
    if (!q) break;
    assert.equal(q.difficulty, 7);
    assert.ok(!used.includes(q.id));
    used.push(q.id);
  }
  assert.equal(selectQuestion(questions, 41, used, a), null);
  assert.ok(selectQuestion(questions, 1, used, a));
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

test("cross-run history prefers unseen questions and never escalates an exhausted tier", () => {
  const bank = questions.filter((q) => q.difficulty === 1).slice(0, 3);
  const seen = { [bank[0].topicKey ?? bank[0].id]: 100 };
  assert.notEqual(selectQuestion(bank, 1, [], () => 0, seen)?.id, bank[0].id);
  const full = Object.fromEntries(
    bank.map((q, i) => [q.topicKey ?? q.id, 100 + i]),
  );
  assert.equal(selectQuestion(bank, 1, [], () => 0, full), null);
  assert.equal(
    selectQuestion(bank, 6, [], () => 0, {}),
    null,
  );
  const sameFact = { ...bank[1], topicKey: bank[0].topicKey ?? bank[0].id };
  assert.equal(
    selectQuestion([bank[0], sameFact], 1, [bank[0].id], () => 0),
    null,
  );
});

test("all five genre pools cover every tier, stay in genre, and progress to tier seven", async () => {
  const { GENRES } = await import("../lib/genres");
  const { questionsForGenre } = await import("../lib/game");
  for (const genre of GENRES) {
    const pool = questionsForGenre(questions, genre.id);
    for (let tier = 1; tier <= 7; tier++)
      assert.ok(
        pool.filter((q) => q.difficulty === tier).length >=
          (tier >= 5 && tier <= 6 ? 10 : 5),
        `${genre.id} tier ${tier}`,
      );
    if (genre.id !== "mixed")
      assert.ok(pool.every((q) => q.genre === genre.id));
    let r = startRun(pool, seededRandom(7), 0),
      now = 0;
    for (let level = 1; level < 45; level++) {
      assert.equal(r.phase, "playing", `${genre.id} level ${level}`);
      now += 100;
      r = answerRun(r, r.question!.answer, now);
      now += 600;
      r = nextQuestion(r, pool, seededRandom(level), now);
    }
    assert.equal(r.level, 45);
    assert.equal(new Set(r.used).size, r.used.length);
  }
});
