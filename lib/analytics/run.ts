import type { Genre } from "../genres";
import type { Run } from "../game";
import { config } from "../game";
import {
  analyticsSummary,
  saveAnalyticsSummary,
  trackGameStarted,
  trackGameOver,
  trackQuestionShown,
  trackQuestionAnswered,
  trackLevelReached,
  trackEvent,
  type AnalyticsSummary,
} from "../analytics";
import {
  COMBO_MILESTONES,
  isAnalyticsLevelMilestone,
  type Mode,
} from "./types";
export function createRunTracker(
  id: string,
  mode: Mode,
  fallback: AnalyticsSummary,
  genre: Genre = "mixed",
) {
  const baseline = analyticsSummary(fallback),
    started = performance.now();
  let previous: Run | null = null,
    ended = false;
  trackGameStarted({
    run_id: id,
    mode,
    genre,
    starting_time: config.startMs / 1000,
    previous_best_score: baseline.bestScore,
    previous_best_level: baseline.bestLevel,
    games_played: baseline.gamesPlayed,
  });
  return {
    id,
    observe(r: Run) {
      try {
        const now = performance.now(),
          remaining = Math.max(0, r.deadline - now) / 1000;
        const q = r.question;
        if (q && r.phase === "playing" && previous?.question?.id !== q.id) {
          trackQuestionShown({
            run_id: id,
            question_id: q.id,
            level: r.level,
            difficulty: q.difficulty,
            category: q.category,
            question_type: q.type,
            time_remaining: remaining,
          });
          if (isAnalyticsLevelMilestone(r.level))
            trackLevelReached({
              run_id: id,
              level: r.level,
              score: r.score,
              time_remaining: remaining,
              combo: r.combo,
            });
        }
        if (
          q &&
          r.feedback &&
          (!previous?.feedback || previous.question?.id !== q.id)
        ) {
          trackQuestionAnswered({
            run_id: id,
            question_id: q.id,
            level: r.level,
            difficulty: q.difficulty,
            category: q.category,
            question_type: q.type,
            correct: r.feedback.correct,
            response_time_ms:
              r.feedback.responseTimeMs ??
              Math.max(0, now - (previous?.questionStartedAt ?? now)),
            time_before_answer: (r.feedback.timeBeforeMs ?? 0) / 1000,
            time_after_answer: (r.feedback.timeAfterMs ?? 0) / 1000,
            combo_before: previous?.combo ?? 0,
            combo_after: r.combo,
            score_awarded: r.feedback.points,
            current_score: r.score,
          });
          if ((COMBO_MILESTONES as readonly number[]).includes(r.combo))
            trackEvent(
              "combo_reached",
              {
                run_id: id,
                combo: r.combo,
                level: r.level,
                score: r.score,
                time_remaining: remaining,
              },
              `combo:${id}:${r.combo}`,
            );
        }
        if (r.phase === "gameOver" && !ended) {
          ended = true;
          const attempted = r.correct + r.incorrect;
          trackGameOver({
            run_id: id,
            final_score: r.score,
            final_level: r.level,
            correct_answers: r.correct,
            wrong_answers: r.incorrect,
            accuracy: attempted ? (100 * r.correct) / attempted : 0,
            best_combo: r.bestCombo,
            questions_attempted: attempted,
            run_duration_seconds: Math.max(0, now - started) / 1000,
            previous_best_score: baseline.bestScore,
            new_personal_best: r.score > baseline.bestScore,
            mode,
            genre,
          });
          saveAnalyticsSummary({
            gamesPlayed: baseline.gamesPlayed + 1,
            bestScore: Math.max(baseline.bestScore, r.score),
            bestLevel: Math.max(baseline.bestLevel, r.level),
          });
        }
        previous = r;
      } catch {
        /* Telemetry cannot interrupt a run. */
      }
    },
  };
}
