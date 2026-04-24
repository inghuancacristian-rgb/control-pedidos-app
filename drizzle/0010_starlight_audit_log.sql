CREATE TABLE `auditLog` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `entityType` varchar(100) NOT NULL,
  `entityId` int NOT NULL,
  `action` enum('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  `userId` int DEFAULT NULL,
  `oldValues` text,
  `newValues` text,
  `description` text,
  `ipAddress` varchar(45),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_entity` (`entityType`, `entityId`),
  INDEX `idx_user` (`userId`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;