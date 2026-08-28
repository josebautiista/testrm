-- AlterTable
ALTER TABLE `RmVigente` ADD COLUMN `serieRealizadaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `SesionRealizada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesionPlanificadaId` INTEGER NULL,
    `personaId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `duracionMin` INTEGER NULL,
    `rpeSesion` INTEGER NULL,
    `estado` VARCHAR(191) NOT NULL,
    `motivoOmision` VARCHAR(191) NULL,
    `notas` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SesionRealizada_personaId_fecha_idx`(`personaId`, `fecha`),
    INDEX `SesionRealizada_sesionPlanificadaId_idx`(`sesionPlanificadaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SerieRealizada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesionRealizadaId` INTEGER NOT NULL,
    `prescripcionId` INTEGER NULL,
    `ejercicioId` INTEGER NOT NULL,
    `numeroSerie` INTEGER NOT NULL,
    `cargaKg` DOUBLE NOT NULL,
    `repeticiones` INTEGER NOT NULL,
    `rir` INTEGER NULL,
    `fallo` BOOLEAN NOT NULL DEFAULT false,
    `e1rmKg` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SerieRealizada_sesionRealizadaId_idx`(`sesionRealizadaId`),
    INDEX `SerieRealizada_ejercicioId_idx`(`ejercicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RmVigente` ADD CONSTRAINT `RmVigente_serieRealizadaId_fkey` FOREIGN KEY (`serieRealizadaId`) REFERENCES `SerieRealizada`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SesionRealizada` ADD CONSTRAINT `SesionRealizada_sesionPlanificadaId_fkey` FOREIGN KEY (`sesionPlanificadaId`) REFERENCES `SesionPlanificada`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SesionRealizada` ADD CONSTRAINT `SesionRealizada_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerieRealizada` ADD CONSTRAINT `SerieRealizada_sesionRealizadaId_fkey` FOREIGN KEY (`sesionRealizadaId`) REFERENCES `SesionRealizada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerieRealizada` ADD CONSTRAINT `SerieRealizada_prescripcionId_fkey` FOREIGN KEY (`prescripcionId`) REFERENCES `Prescripcion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerieRealizada` ADD CONSTRAINT `SerieRealizada_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
