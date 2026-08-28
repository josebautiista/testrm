-- AlterTable
ALTER TABLE `SerieRealizada` ADD COLUMN `requestId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SerieRealizada_requestId_key` ON `SerieRealizada`(`requestId`);
