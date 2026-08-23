-- CreateTable
CREATE TABLE `MacrocicloSemanaEjercicio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloSemanaId` INTEGER NOT NULL,
    `ejercicioId` INTEGER NOT NULL,
    `formulaRm` VARCHAR(191) NOT NULL,
    `rm` DOUBLE NOT NULL,
    `peso` DOUBLE NOT NULL,
    `volumen` DOUBLE NOT NULL,

    UNIQUE INDEX `MacrocicloSemanaEjercicio_macrocicloSemanaId_ejercicioId_key`(`macrocicloSemanaId`, `ejercicioId`),
    INDEX `MacrocicloSemanaEjercicio_ejercicioId_idx`(`ejercicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MacrocicloSemanaEjercicio` ADD CONSTRAINT `MacrocicloSemanaEjercicio_macrocicloSemanaId_fkey` FOREIGN KEY (`macrocicloSemanaId`) REFERENCES `MacrocicloSemana`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloSemanaEjercicio` ADD CONSTRAINT `MacrocicloSemanaEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
