-- AlterTable
ALTER TABLE `serierealizada` ADD COLUMN `requestId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SerieRealizada_requestId_key` ON `serierealizada`(`requestId`);
