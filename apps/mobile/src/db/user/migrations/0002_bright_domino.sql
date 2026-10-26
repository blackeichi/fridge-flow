CREATE TABLE `backup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	`checksum` text NOT NULL,
	`safety_database_name` text
);
