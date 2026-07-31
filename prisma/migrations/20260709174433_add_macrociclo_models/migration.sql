-- CreateTable
CREATE TABLE `Macrociclo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `personaId` INTEGER NOT NULL,
    `objetivoTipo` VARCHAR(191) NOT NULL,
    `objetivoDetalle` VARCHAR(191) NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `fechaCompetencia` DATE NULL,
    `estado` VARCHAR(191) NOT NULL,
    `pasoActual` INTEGER NOT NULL DEFAULT 1,
    `sesionRmId` INTEGER NULL,
    `rmSnapshot` JSON NULL,
    `medidasSnapshot` JSON NULL,
    `vo2maxSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedReason` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Macrociclo_personaId_estado_idx`(`personaId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MacrocicloPeriodo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `porcentaje` DOUBLE NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `orden` INTEGER NOT NULL,

    INDEX `MacrocicloPeriodo_macrocicloId_orden_idx`(`macrocicloId`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MacrocicloEtapa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodoId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `porcentaje` DOUBLE NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `orden` INTEGER NOT NULL,

    INDEX `MacrocicloEtapa_periodoId_orden_idx`(`periodoId`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MacrocicloMesociclo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `porcentaje` DOUBLE NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `orden` INTEGER NOT NULL,

    INDEX `MacrocicloMesociclo_macrocicloId_orden_idx`(`macrocicloId`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MacrocicloSemana` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloId` INTEGER NOT NULL,
    `mesocicloId` INTEGER NOT NULL,
    `numeroSemana` INTEGER NOT NULL,
    `mesCalendario` INTEGER NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `tipoMicrociclo` VARCHAR(191) NOT NULL,
    `frecuencia` INTEGER NOT NULL,
    `volumen` DOUBLE NOT NULL,
    `intensidad` DOUBLE NOT NULL,
    `notas` VARCHAR(191) NULL,

    INDEX `MacrocicloSemana_macrocicloId_numeroSemana_idx`(`macrocicloId`, `numeroSemana`),
    INDEX `MacrocicloSemana_mesocicloId_idx`(`mesocicloId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MacrocicloAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `macrocicloId` INTEGER NOT NULL,
    `personaId` INTEGER NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `userType` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MacrocicloAuditLog_macrocicloId_createdAt_idx`(`macrocicloId`, `createdAt`),
    INDEX `MacrocicloAuditLog_personaId_createdAt_idx`(`personaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Macrociclo` ADD CONSTRAINT `Macrociclo_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Macrociclo` ADD CONSTRAINT `Macrociclo_sesionRmId_fkey` FOREIGN KEY (`sesionRmId`) REFERENCES `Sesion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloPeriodo` ADD CONSTRAINT `MacrocicloPeriodo_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloEtapa` ADD CONSTRAINT `MacrocicloEtapa_periodoId_fkey` FOREIGN KEY (`periodoId`) REFERENCES `MacrocicloPeriodo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloMesociclo` ADD CONSTRAINT `MacrocicloMesociclo_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloSemana` ADD CONSTRAINT `MacrocicloSemana_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloSemana` ADD CONSTRAINT `MacrocicloSemana_mesocicloId_fkey` FOREIGN KEY (`mesocicloId`) REFERENCES `MacrocicloMesociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MacrocicloAuditLog` ADD CONSTRAINT `MacrocicloAuditLog_macrocicloId_fkey` FOREIGN KEY (`macrocicloId`) REFERENCES `Macrociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
