-- CreateTable
CREATE TABLE `macrociclosemanaejercicio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloSemanaId` INTEGER NOT NULL,
    `ejercicioId` INTEGER NOT NULL,
    `formulaRm` VARCHAR(191) NOT NULL,
    `rm` DOUBLE NOT NULL,
    `peso` DOUBLE NOT NULL,
    `volumen` DOUBLE NOT NULL,

    UNIQUE INDEX `macrociclosemanaejercicio_macrocicloSemanaId_ejercicioId_key`(`macrocicloSemanaId`, `ejercicioId`),
    INDEX `macrociclosemanaejercicio_ejercicioId_idx`(`ejercicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `macrociclosemanaejercicio` ADD CONSTRAINT `macrociclosemanaejercicio_macrocicloSemanaId_fkey` FOREIGN KEY (`macrocicloSemanaId`) REFERENCES `macrociclosemana`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `macrociclosemanaejercicio` ADD CONSTRAINT `macrociclosemanaejercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
