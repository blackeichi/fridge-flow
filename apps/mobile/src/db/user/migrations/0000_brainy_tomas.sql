CREATE TABLE `app_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'ko-KR' NOT NULL,
	`timezone` text NOT NULL,
	`preferences` text DEFAULT '{}' NOT NULL,
	`allergy_flags` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "app_profiles_singleton_id_check" CHECK("app_profiles"."id" = 'default')
);
--> statement-breakpoint
CREATE TABLE `containers` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`grid_row` integer NOT NULL,
	`grid_column` integer NOT NULL,
	`grid_width` integer DEFAULT 1 NOT NULL,
	`grid_height` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `storage_spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`,`space_id`) REFERENCES `containers`(`id`,`space_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "containers_name_check" CHECK(length(trim("containers"."name")) BETWEEN 1 AND 60),
	CONSTRAINT "containers_grid_row_check" CHECK("containers"."grid_row" >= 0),
	CONSTRAINT "containers_grid_column_check" CHECK("containers"."grid_column" >= 0),
	CONSTRAINT "containers_grid_width_check" CHECK("containers"."grid_width" > 0),
	CONSTRAINT "containers_grid_height_check" CHECK("containers"."grid_height" > 0),
	CONSTRAINT "containers_sort_order_check" CHECK("containers"."sort_order" >= 0),
	CONSTRAINT "containers_parent_self_check" CHECK("containers"."parent_id" IS NULL OR "containers"."parent_id" <> "containers"."id")
);
--> statement-breakpoint
CREATE INDEX `containers_space_id_idx` ON `containers` (`space_id`);--> statement-breakpoint
CREATE INDEX `containers_parent_id_idx` ON `containers` (`parent_id`);--> statement-breakpoint
CREATE INDEX `containers_sort_order_idx` ON `containers` (`space_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `containers_id_space_id_unique` ON `containers` (`id`,`space_id`);--> statement-breakpoint
CREATE TABLE `local_owners` (
	`owner_sub_sha256` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text NOT NULL,
	CONSTRAINT "local_owners_owner_hash_check" CHECK(length("local_owners"."owner_sub_sha256") = 64 AND "local_owners"."owner_sub_sha256" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE TABLE `storage_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "storage_spaces_name_check" CHECK(length(trim("storage_spaces"."name")) BETWEEN 1 AND 60),
	CONSTRAINT "storage_spaces_type_check" CHECK("storage_spaces"."type" IN ('refrigerator', 'freezer', 'pantry')),
	CONSTRAINT "storage_spaces_sort_order_check" CHECK("storage_spaces"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_spaces_name_unique` ON `storage_spaces` (`name`);--> statement-breakpoint
CREATE INDEX `storage_spaces_sort_order_idx` ON `storage_spaces` (`sort_order`);