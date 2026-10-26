CREATE TABLE `inventory_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`container_id` text NOT NULL,
	`amount` text,
	`unit` text NOT NULL,
	`quantity_known` integer NOT NULL,
	`purchased_on` text,
	`expires_on` text,
	`notes` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`last_operation_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_batches_name_check" CHECK(length(trim("inventory_batches"."name")) BETWEEN 1 AND 100),
	CONSTRAINT "inventory_batches_unit_check" CHECK("inventory_batches"."unit" IN ('g','kg','ml','L','개','팩','봉','병','캔')),
	CONSTRAINT "inventory_batches_quantity_check" CHECK(("inventory_batches"."quantity_known" = 0 AND "inventory_batches"."amount" IS NULL) OR ("inventory_batches"."quantity_known" = 1 AND "inventory_batches"."amount" IS NOT NULL AND length("inventory_batches"."amount") BETWEEN 1 AND 16 AND "inventory_batches"."amount" NOT GLOB '*[^0-9.]*' AND "inventory_batches"."amount" GLOB '[0-9]*' AND length("inventory_batches"."amount") - length(replace("inventory_batches"."amount", '.', '')) <= 1 AND substr("inventory_batches"."amount", -1) <> '.' AND CAST("inventory_batches"."amount" AS REAL) >= 0)),
	CONSTRAINT "inventory_batches_status_check" CHECK("inventory_batches"."status" IN ('available','exhausted','discarded','deleted')),
	CONSTRAINT "inventory_batches_exhausted_check" CHECK("inventory_batches"."status" <> 'exhausted' OR ("inventory_batches"."quantity_known" = 1 AND CAST("inventory_batches"."amount" AS REAL) = 0)),
	CONSTRAINT "inventory_batches_available_check" CHECK("inventory_batches"."status" <> 'available' OR "inventory_batches"."quantity_known" = 0 OR CAST("inventory_batches"."amount" AS REAL) > 0)
);
--> statement-breakpoint
CREATE INDEX `inventory_batches_container_idx` ON `inventory_batches` (`container_id`);--> statement-breakpoint
CREATE INDEX `inventory_batches_expiry_idx` ON `inventory_batches` (`status`,`expires_on`);--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`operation_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_delta` text,
	`before` text,
	`after` text NOT NULL,
	`reverses_operation_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_transactions_type_check" CHECK("inventory_transactions"."type" IN ('create','update','delete','undo'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_transactions_id_unique` ON `inventory_transactions` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_transactions_operation_id_unique` ON `inventory_transactions` (`operation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_transactions_reverses_operation_id_unique` ON `inventory_transactions` (`reverses_operation_id`);--> statement-breakpoint
CREATE INDEX `inventory_transactions_batch_idx` ON `inventory_transactions` (`batch_id`);