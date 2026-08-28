-- AlterTable
ALTER TABLE `Macrociclo` ADD COLUMN `capacidadDominante` VARCHAR(191) NULL,
    ADD COLUMN `estructuraCalendario` VARCHAR(191) NULL,
    ADD COLUMN `nivelAtleta` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MacrocicloCompetencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL,
    `importancia` VARCHAR(191) NOT NULL,
    `notas` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MacrocicloCompetencia_macrocicloId_fecha_idx`(`macrocicloId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MacrocicloCompetencia` ADD CONSTRAINT `MacrocicloCompetencia_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
