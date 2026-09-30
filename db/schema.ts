import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
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
    genre: text("genre").notNull().default("mixed"),
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
    index("runs_genre_score").on(t.season, t.genre, t.status, t.score),
    index("runs_player_created").on(t.playerId, t.createdAt),
    index("runs_category_all_time").on(t.genre, t.status, t.score),
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

export const authNonces = sqliteTable(
  "auth_nonces",
  {
    hash: text("hash").primaryKey(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("auth_nonce_expiry").on(t.expiresAt)],
);

export const matches = sqliteTable(
  "matches",
  {
    code: text("code").primaryKey(),
    hostId: text("host_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    genre: text("genre").notNull(),
    status: text("status").notNull().default("waiting"),
    questions: text("questions").notNull(),
    revision: integer("revision").notNull().default(0),
    teamOneName: text("team_one_name").notNull().default("Team 1"),
    teamTwoName: text("team_two_name").notNull().default("Team 2"),
    createdAt: integer("created_at").notNull(),
    startAt: integer("start_at"),
    endAt: integer("end_at"),
    winnerTeam: integer("winner_team"),
    finishedAt: integer("finished_at"),
  },
  (t) => [
    index("matches_host_created").on(t.hostId, t.createdAt),
    index("matches_status_end").on(t.status, t.endAt),
  ],
);
export const matchMembers = sqliteTable(
  "match_members",
  {
    code: text("code")
      .notNull()
      .references(() => matches.code, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    team: integer("team").notNull(),
    ready: integer("ready").notNull().default(0),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.code, t.playerId] }),
    index("match_member_player").on(t.playerId, t.code),
  ],
);
export const matchAnswers = sqliteTable(
  "match_answers",
  {
    code: text("code")
      .notNull()
      .references(() => matches.code, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    answer: text("answer").notNull(),
    correct: integer("correct").notNull(),
    score: integer("score").notNull(),
    answeredAt: integer("answered_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.code, t.playerId, t.round] })],
);

// Approved playable catalog. Large candidate imports remain outside this table until review.
export const questionBank = sqliteTable(
  "question_bank",
  {
    id: text("id").primaryKey(),
    topicKey: text("topic_key").notNull(),
    promptHash: text("prompt_hash").notNull().unique(),
    genre: text("genre").notNull(),
    difficulty: integer("difficulty").notNull(),
    sortKey: integer("sort_key").notNull(),
    active: integer("active").notNull().default(1),
    payload: text("payload").notNull(),
    bankVersion: text("bank_version").notNull(),
  },
  (t) => [
    index("bank_category_pick").on(t.active, t.genre, t.difficulty, t.sortKey),
    index("bank_mixed_pick").on(t.active, t.difficulty, t.sortKey),
    index("bank_topic").on(t.topicKey),
  ],
);
// Exact membership, not a probabilistic Bloom filter. Reserve before returning a question.
export const playerQuestionSeen = sqliteTable(
  "player_question_seen",
  {
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    topicKey: text("topic_key").notNull(),
    questionId: text("question_id").notNull(),
    firstSeenAt: integer("first_seen_at").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.topicKey] })],
);

// Fixed immutable decks. Daily/friend modes intentionally permit previously seen facts.
export const challengeSets = sqliteTable(
  "challenge_sets",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    day: text("day").unique(),
    creatorActor: text("creator_actor"),
    creatorName: text("creator_name").notNull().default("A friend"),
    parentId: text("parent_id"),
    deck: text("deck").notNull(),
    rulesVersion: integer("rules_version").notNull(),
    bankVersion: text("bank_version").notNull(),
    createdAt: integer("created_at").notNull(),
    opensAt: integer("opens_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("challenge_creator_created").on(t.creatorActor, t.createdAt)],
);
export const challengeAttempts = sqliteTable(
  "challenge_attempts",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => challengeSets.id),
    actor: text("actor").notNull(),
    playerId: text("player_id").references(() => players.id, {
      onDelete: "cascade",
    }),
    displayName: text("display_name").notNull(),
    state: text("state").notNull(),
    answers: text("answers").notNull().default("[]"),
    version: integer("version").notNull().default(0),
    status: text("status").notNull().default("active"),
    score: integer("score").notNull().default(0),
    result: text("result"),
    createdAt: integer("created_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [
    index("challenge_ranking").on(t.setId, t.status, t.score, t.finishedAt),
    index("challenge_actor_created").on(t.actor, t.createdAt),
    uniqueIndex("challenge_once").on(t.setId, t.actor),
  ],
);
