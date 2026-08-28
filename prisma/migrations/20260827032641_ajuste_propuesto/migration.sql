-- CreateTable
CREATE TABLE `AjustePropuesto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `personaId` INTEGER NOT NULL,
    `macrocicloId` INTEGER NOT NULL,
    `alcance` VARCHAR(191) NOT NULL,
    `objetivoId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `magnitud` DOUBLE NULL,
    `justificacion` VARCHAR(191) NOT NULL,
    `evidencia` JSON NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `resueltoPor` VARCHAR(191) NULL,
    `resueltoEn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AjustePropuesto_personaId_estado_idx`(`personaId`, `estado`),
    INDEX `AjustePropuesto_macrocicloId_estado_idx`(`macrocicloId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AjustePropuesto` ADD CONSTRAINT `AjustePropuesto_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjustePropuesto` ADD CONSTRAINT `AjustePropuesto_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
