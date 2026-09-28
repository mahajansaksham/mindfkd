CREATE TABLE `question_events` (
	`run_id` text NOT NULL,
	`question_id` text NOT NULL,
	`topic_key` text NOT NULL,
	`player_id` text NOT NULL,
	`bank_version` text NOT NULL,
	`difficulty` integer NOT NULL,
	`shown_at` integer NOT NULL,
	`answered_at` integer,
	`elapsed_ms` integer,
	`correct` integer,
	PRIMARY KEY(`run_id`, `question_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_history_player` ON `question_events` (`player_id`,`topic_key`);--> statement-breakpoint
CREATE INDEX `question_calibration` ON `question_events` (`bank_version`,`question_id`);--> statement-breakpoint
ALTER TABLE `runs` ADD `season` text DEFAULT 'launch' NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `bank_version` text DEFAULT 'launch' NOT NULL;--> statement-breakpoint
CREATE INDEX `runs_season_score` ON `runs` (`season`,`status`,`score`);