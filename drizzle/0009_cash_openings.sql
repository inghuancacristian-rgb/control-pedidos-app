CREATE TABLE `cash_openings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openingDate` varchar(10) NOT NULL,
  `openingAmount` int NOT NULL DEFAULT 0,
  `responsibleUserId` int NOT NULL,
  `openedByUserId` int NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `cash_openings_id` PRIMARY KEY(`id`)
);

ALTER TABLE `cash_openings`
  ADD CONSTRAINT `cash_openings_responsibleUserId_users_id_fk`
  FOREIGN KEY (`responsibleUserId`) REFERENCES `users`(`id`)
  ON DELETE no action ON UPDATE no action;

ALTER TABLE `cash_openings`
  ADD CONSTRAINT `cash_openings_openedByUserId_users_id_fk`
  FOREIGN KEY (`openedByUserId`) REFERENCES `users`(`id`)
  ON DELETE no action ON UPDATE no action;
