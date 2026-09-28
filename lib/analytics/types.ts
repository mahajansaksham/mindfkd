import type { Genre } from "../genres";
export type Scalar = string | number | boolean;
export type Properties = Record<string, Scalar>;
export type Mode = "guest" | "ranked";
export type Acquisition = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
};
type QuestionFields = {
  run_id: string;
  question_id: string;
  level: number;
  difficulty: number;
  category: string;
  question_type: string;
};
export type AnalyticsEventMap = {
  page_view: Acquisition & { page: string };
  game_started: {
    run_id: string;
    mode: Mode;
    genre?: Genre;
    starting_time: number;
    previous_best_score: number;
    previous_best_level: number;
    games_played: number;
    is_returning_player: boolean;
  };
  question_shown: QuestionFields & { time_remaining: number };
  question_answered: QuestionFields & {
    correct: boolean;
    response_time_ms: number;
    time_before_answer: number;
    time_after_answer: number;
    combo_before: number;
    combo_after: number;
    score_awarded: number;
    current_score: number;
  };
  level_reached: {
    run_id: string;
    level: number;
    score: number;
    time_remaining: number;
    combo: number;
  };
  combo_reached: {
    run_id: string;
    combo: number;
    level: number;
    score: number;
    time_remaining: number;
  };
  game_over: {
    run_id: string;
    final_score: number;
    final_level: number;
    correct_answers: number;
    wrong_answers: number;
    accuracy: number;
    best_combo: number;
    questions_attempted: number;
    run_duration_seconds: number;
    previous_best_score: number;
    new_personal_best: boolean;
    mode: Mode;
    genre?: Genre;
  };
  run_replayed: {
    run_id: string;
    previous_run_id: string;
    previous_score: number;
    previous_level: number;
  };
  score_shared: {
    run_id: string;
    score: number;
    level: number;
    share_method: "native_share" | "clipboard" | "challenge_link";
  };
  stats_opened: {
    games_played: number;
    best_score: number;
    best_level: number;
  };
  how_to_play_opened: Record<string, never>;
  returning_player: {
    days_since_last_visit: number;
    total_visit_days: number;
    games_played: number;
  };
  challenge_opened: { challenge_id: string; page: string };
};
export type EventName = keyof AnalyticsEventMap;
export type Envelope = {
  name: EventName;
  properties: Properties;
  player_id: string;
  session_id: string;
  acquisition: Acquisition;
  firstTouch: Acquisition;
};
export type AnalyticsProvider = { name: string; send(event: Envelope): void };
export const LEVEL_MILESTONES = [5, 10, 15, 20, 25, 30, 35, 40, 50] as const;
export const COMBO_MILESTONES = [5, 10, 15, 20] as const;
export const isAnalyticsLevelMilestone = (level: number) =>
  (LEVEL_MILESTONES as readonly number[]).includes(level);
