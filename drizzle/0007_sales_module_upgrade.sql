ALTER TABLE `sales`
  ADD COLUMN `status` enum('completed','cancelled') NOT NULL DEFAULT 'completed' AFTER `saleChannel`,
  ADD COLUMN `discountType` enum('none','percentage','fixed') NOT NULL DEFAULT 'none' AFTER `subtotal`,
  ADD COLUMN `discountValue` int NOT NULL DEFAULT 0 AFTER `discountType`,
  ADD COLUMN `cancelReason` text AFTER `notes`,
  ADD COLUMN `cancelledAt` timestamp NULL AFTER `cancelReason`,
  ADD COLUMN `cancelledBy` int AFTER `cancelledAt`;

ALTER TABLE `sales`
  ADD CONSTRAINT `sales_cancelledBy_users_id_fk`
  FOREIGN KEY (`cancelledBy`) REFERENCES `users`(`id`)
  ON DELETE no action ON UPDATE no action;

ALTER TABLE `saleItems`
  ADD COLUMN `discountType` enum('none','percentage','fixed') NOT NULL DEFAULT 'none' AFTER `basePrice`,
  ADD COLUMN `discountAmount` int NOT NULL DEFAULT 0 AFTER `discountValue`,
  ADD COLUMN `finalUnitPrice` int NOT NULL DEFAULT 0 AFTER `discountAmount`;

UPDATE `saleItems`
SET
  `discountType` = 'fixed',
  `discountAmount` = `discountValue` * `quantity`,
  `finalUnitPrice` = GREATEST(`basePrice` - `discountValue`, 0)
WHERE `finalUnitPrice` = 0;
