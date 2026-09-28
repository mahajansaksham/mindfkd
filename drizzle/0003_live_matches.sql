CREATE TABLE `match_answers` (
	`code` text NOT NULL,
	`player_id` text NOT NULL,
	`round` integer NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`score` integer NOT NULL,
	`answered_at` integer NOT NULL,
	PRIMARY KEY(`code`, `player_id`, `round`),
	FOREIGN KEY (`code`) REFERENCES `matches`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_members` (
	`code` text NOT NULL,
	`player_id` text NOT NULL,
	`team` integer NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`code`, `player_id`),
	FOREIGN KEY (`code`) REFERENCES `matches`(`code`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_member_player` ON `match_members` (`player_id`,`code`);--> statement-breakpoint
CREATE TABLE `matches` (
	`code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`mode` text NOT NULL,
	`genre` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`questions` text NOT NULL,
	`created_at` integer NOT NULL,
	`start_at` integer,
	`end_at` integer,
	`winner_team` integer,
	`finished_at` integer,
	FOREIGN KEY (`host_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matches_host_created` ON `matches` (`host_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `matches_status_end` ON `matches` (`status`,`end_at`);