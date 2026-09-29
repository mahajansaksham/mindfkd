ALTER TABLE `matches` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `team_one_name` text DEFAULT 'Team 1' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `team_two_name` text DEFAULT 'Team 2' NOT NULL;--> statement-breakpoint
CREATE INDEX `runs_category_all_time` ON `runs` (`genre`,`status`,`score`);--> statement-breakpoint
CREATE TRIGGER match_members_insert_revision AFTER INSERT ON match_members BEGIN UPDATE matches SET revision=revision+1 WHERE code=NEW.code; END;
--> statement-breakpoint
CREATE TRIGGER match_members_update_revision AFTER UPDATE ON match_members BEGIN UPDATE matches SET revision=revision+1 WHERE code=NEW.code; END;
--> statement-breakpoint
CREATE TRIGGER match_members_delete_revision AFTER DELETE ON match_members BEGIN UPDATE matches SET revision=revision+1 WHERE code=OLD.code; END;
--> statement-breakpoint
CREATE TRIGGER match_answers_insert_revision AFTER INSERT ON match_answers BEGIN UPDATE matches SET revision=revision+1 WHERE code=NEW.code; END;
