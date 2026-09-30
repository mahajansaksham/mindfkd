CREATE TABLE `challenge_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`actor` text NOT NULL,
	`player_id` text,
	`display_name` text NOT NULL,
	`state` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`result` text,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`set_id`) REFERENCES `challenge_sets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `challenge_ranking` ON `challenge_attempts` (`set_id`,`status`,`score`,`finished_at`);--> statement-breakpoint
CREATE INDEX `challenge_actor_created` ON `challenge_attempts` (`actor`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_once` ON `challenge_attempts` (`set_id`,`actor`);--> statement-breakpoint
CREATE TABLE `challenge_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`day` text,
	`creator_actor` text,
	`creator_name` text DEFAULT 'A friend' NOT NULL,
	`parent_id` text,
	`deck` text NOT NULL,
	`rules_version` integer NOT NULL,
	`bank_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`opens_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_sets_day_unique` ON `challenge_sets` (`day`);--> statement-breakpoint
CREATE INDEX `challenge_creator_created` ON `challenge_sets` (`creator_actor`,`created_at`);