-- AlterTable
ALTER TABLE `ResultadoEjercicio` ADD COLUMN `confianza` VARCHAR(191) NULL,
    ADD COLUMN `formulaPrimaria` VARCHAR(191) NULL,
    ADD COLUMN `fueraDeRango` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `rirReportado` INTEGER NULL,
    ADD COLUMN `rm1Estimado` DOUBLE NULL,
    ADD COLUMN `rmMax` DOUBLE NULL,
    ADD COLUMN `rmMin` DOUBLE NULL;

-- CreateTable
CREATE TABLE `RmVigente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `personaId` INTEGER NOT NULL,
    `ejercicioId` INTEGER NOT NULL,
    `valorKg` DOUBLE NOT NULL,
    `origen` VARCHAR(191) NOT NULL,
    `confianza` VARCHAR(191) NOT NULL,
    `resultadoRmId` INTEGER NULL,
    `validoDesde` DATETIME(3) NOT NULL,
    `validoHasta` DATETIME(3) NULL,
    `calculadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RmVigente_personaId_ejercicioId_validoDesde_idx`(`personaId`, `ejercicioId`, `validoDesde`),
    INDEX `RmVigente_personaId_ejercicioId_validoHasta_idx`(`personaId`, `ejercicioId`, `validoHasta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RmVigente` ADD CONSTRAINT `RmVigente_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RmVigente` ADD CONSTRAINT `RmVigente_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RmVigente` ADD CONSTRAINT `RmVigente_resultadoRmId_fkey` FOREIGN KEY (`resultadoRmId`) REFERENCES `ResultadoEjercicio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
