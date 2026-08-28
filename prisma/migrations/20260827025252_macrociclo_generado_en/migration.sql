-- AlterTable
ALTER TABLE `Macrociclo` ADD COLUMN `generadoEn` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
