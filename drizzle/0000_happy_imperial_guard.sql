CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_target` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`username` text,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_google_sub_unique` ON `players` (`google_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_username_unique` ON `players` (`username`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`incorrect` integer DEFAULT 0 NOT NULL,
	`best_combo` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_player_status` ON `runs` (`player_id`,`status`);--> statement-breakpoint
CREATE INDEX `runs_leaderboard` ON `runs` (`status`,`score`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_expiry` ON `sessions` (`expires_at`);