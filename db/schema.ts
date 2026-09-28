import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  username: text("username").unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("session_expiry").on(t.expiresAt)],
);
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    season: text("season").notNull().default("launch"),
    bankVersion: text("bank_version").notNull().default("launch"),
    version: integer("version").notNull().default(0),
    status: text("status").notNull(),
    score: integer("score").notNull().default(0),
    level: integer("level").notNull().default(1),
    correct: integer("correct").notNull().default(0),
    incorrect: integer("incorrect").notNull().default(0),
    bestCombo: integer("best_combo").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [
    index("runs_player_status").on(t.playerId, t.status),
    index("runs_leaderboard").on(t.status, t.score),
    index("runs_season_score").on(t.season, t.status, t.score),
  ],
);
export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_target").on(t.followingId),
  ],
);

// One exposure per run/question. Records survive question retirement and are private.
export const questionEvents = sqliteTable(
  "question_events",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    topicKey: text("topic_key").notNull(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    bankVersion: text("bank_version").notNull(),
    difficulty: integer("difficulty").notNull(),
    shownAt: integer("shown_at").notNull(),
    answeredAt: integer("answered_at"),
    elapsedMs: integer("elapsed_ms"),
    correct: integer("correct"),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.questionId] }),
    index("question_history_player").on(t.playerId, t.topicKey),
    index("question_calibration").on(t.bankVersion, t.questionId),
  ],
);
