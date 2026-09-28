CREATE TABLE `auth_nonces` (
	`hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_nonce_expiry` ON `auth_nonces` (`expires_at`);--> statement-breakpoint
ALTER TABLE `runs` ADD `genre` text DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
CREATE INDEX `runs_genre_score` ON `runs` (`season`,`genre`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `runs_player_created` ON `runs` (`player_id`,`created_at`);