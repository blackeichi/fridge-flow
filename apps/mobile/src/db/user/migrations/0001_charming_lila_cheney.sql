CREATE TABLE `custom_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`category` text,
	`default_unit` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "custom_ingredients_canonical_name_check" CHECK(length(trim("custom_ingredients"."canonical_name")) BETWEEN 1 AND 100),
	CONSTRAINT "custom_ingredients_default_unit_check" CHECK("custom_ingredients"."default_unit" IN ('g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_ingredients_canonical_name_unique` ON `custom_ingredients` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_source` text NOT NULL,
	`ingredient_ref` text NOT NULL,
	`display_name` text NOT NULL,
	`container_id` text NOT NULL,
	`amount` real,
	`unit` text NOT NULL,
	`quantity_known` integer DEFAULT true NOT NULL,
	`package_count` real,
	`package_size` real,
	`package_size_unit` text,
	`purchased_on` text,
	`expires_on` text,
	`opened_on` text,
	`minimum_amount` real,
	`note` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_batches_ingredient_source_check" CHECK("inventory_batches"."ingredient_source" IN ('catalog', 'custom')),
	CONSTRAINT "inventory_batches_ingredient_ref_check" CHECK(length(trim("inventory_batches"."ingredient_ref")) BETWEEN 1 AND 200),
	CONSTRAINT "inventory_batches_display_name_check" CHECK(length(trim("inventory_batches"."display_name")) BETWEEN 1 AND 100),
	CONSTRAINT "inventory_batches_unit_check" CHECK("inventory_batches"."unit" IN ('g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can')),
	CONSTRAINT "inventory_batches_quantity_check" CHECK(("inventory_batches"."quantity_known" = 1 AND "inventory_batches"."amount" > 0) OR ("inventory_batches"."quantity_known" = 0 AND "inventory_batches"."amount" IS NULL)),
	CONSTRAINT "inventory_batches_package_check" CHECK(("inventory_batches"."package_count" IS NULL AND "inventory_batches"."package_size" IS NULL AND "inventory_batches"."package_size_unit" IS NULL) OR ("inventory_batches"."package_count" > 0 AND "inventory_batches"."package_size" > 0 AND "inventory_batches"."package_size_unit" IS NOT NULL)),
	CONSTRAINT "inventory_batches_package_size_unit_check" CHECK("inventory_batches"."package_size_unit" IS NULL OR "inventory_batches"."package_size_unit" IN ('g', 'kg', 'ml', 'L', 'piece')),
	CONSTRAINT "inventory_batches_minimum_amount_check" CHECK("inventory_batches"."minimum_amount" IS NULL OR "inventory_batches"."minimum_amount" >= 0),
	CONSTRAINT "inventory_batches_status_check" CHECK("inventory_batches"."status" IN ('available', 'consumed', 'discarded', 'deleted')),
	CONSTRAINT "inventory_batches_note_check" CHECK("inventory_batches"."note" IS NULL OR length("inventory_batches"."note") <= 500)
);
--> statement-breakpoint
CREATE INDEX `inventory_batches_ingredient_idx` ON `inventory_batches` (`ingredient_source`,`ingredient_ref`);--> statement-breakpoint
CREATE INDEX `inventory_batches_container_idx` ON `inventory_batches` (`container_id`);--> statement-breakpoint
CREATE INDEX `inventory_batches_expiry_idx` ON `inventory_batches` (`status`,`expires_on`);