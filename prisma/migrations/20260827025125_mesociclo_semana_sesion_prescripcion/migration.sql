-- AlterTable
ALTER TABLE `macrociclomesociclo` ADD COLUMN `intensidadMaxPct` DOUBLE NULL,
    ADD COLUMN `intensidadMinPct` DOUBLE NULL,
    ADD COLUMN `objetivoBloque` VARCHAR(191) NULL,
    ADD COLUMN `progresion` VARCHAR(191) NULL,
    ADD COLUMN `repsMax` INTEGER NULL,
    ADD COLUMN `repsMin` INTEGER NULL,
    ADD COLUMN `rirObjetivo` INTEGER NULL,
    ADD COLUMN `seriesSemanalesPorPatron` JSON NULL;

-- AlterTable
ALTER TABLE `macrociclosemana` ADD COLUMN `esDeload` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `factorIntensidad` DOUBLE NOT NULL DEFAULT 1,
    ADD COLUMN `factorVolumen` DOUBLE NOT NULL DEFAULT 1,
    ADD COLUMN `origen` VARCHAR(191) NOT NULL DEFAULT 'generado';

-- CreateTable
CREATE TABLE `SesionPlanificada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semanaId` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL,
    `fechaSugerida` DATE NULL,
    `duracionEstimadaMin` INTEGER NOT NULL,
    `enfoque` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'planificada',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SesionPlanificada_semanaId_idx`(`semanaId`),
    UNIQUE INDEX `SesionPlanificada_semanaId_orden_key`(`semanaId`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prescripcion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesionPlanificadaId` INTEGER NOT NULL,
    `ejercicioId` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL,
    `series` INTEGER NOT NULL,
    `repeticionesObjetivo` INTEGER NOT NULL,
    `repsMin` INTEGER NOT NULL,
    `repsMax` INTEGER NOT NULL,
    `porcentajeRm` DOUBLE NULL,
    `rirObjetivo` INTEGER NOT NULL,
    `cargaKg` DOUBLE NULL,
    `descansoSeg` INTEGER NOT NULL DEFAULT 90,
    `tempo` VARCHAR(191) NULL,
    `notas` VARCHAR(191) NULL,
    `rmUsadoKg` DOUBLE NULL,
    `rmVigenteId` INTEGER NULL,
    `formulaRm` VARCHAR(191) NULL,
    `calculadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `origen` VARCHAR(191) NOT NULL,
    `motivoAjuste` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `supersededById` INTEGER NULL,

    UNIQUE INDEX `Prescripcion_supersededById_key`(`supersededById`),
    INDEX `Prescripcion_sesionPlanificadaId_idx`(`sesionPlanificadaId`),
    INDEX `Prescripcion_ejercicioId_idx`(`ejercicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SesionPlanificada` ADD CONSTRAINT `SesionPlanificada_semanaId_fkey` FOREIGN KEY (`semanaId`) REFERENCES `MacrocicloSemana`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescripcion` ADD CONSTRAINT `Prescripcion_sesionPlanificadaId_fkey` FOREIGN KEY (`sesionPlanificadaId`) REFERENCES `SesionPlanificada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescripcion` ADD CONSTRAINT `Prescripcion_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescripcion` ADD CONSTRAINT `Prescripcion_rmVigenteId_fkey` FOREIGN KEY (`rmVigenteId`) REFERENCES `RmVigente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescripcion` ADD CONSTRAINT `Prescripcion_supersededById_fkey` FOREIGN KEY (`supersededById`) REFERENCES `Prescripcion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
