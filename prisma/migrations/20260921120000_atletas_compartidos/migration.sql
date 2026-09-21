CREATE TABLE `PersonaEntrenador` (
    `personaId` INTEGER NOT NULL,
    `entrenadorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `PersonaEntrenador_entrenadorId_idx`(`entrenadorId`),
    PRIMARY KEY (`personaId`, `entrenadorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PersonaEntrenador` ADD CONSTRAINT `PersonaEntrenador_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PersonaEntrenador` ADD CONSTRAINT `PersonaEntrenador_entrenadorId_fkey` FOREIGN KEY (`entrenadorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Conserva las asignaciones anteriores sin duplicar atletas ni su historial.
INSERT INTO `PersonaEntrenador` (`personaId`, `entrenadorId`)
SELECT `id`, `entrenadorId` FROM `Persona` WHERE `entrenadorId` IS NOT NULL;

CREATE TABLE `PersonaCambio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `personaId` INTEGER NOT NULL,
    `autorId` VARCHAR(191) NOT NULL,
    `autorNombre` VARCHAR(191) NOT NULL,
    `antes` JSON NOT NULL,
    `despues` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `PersonaCambio_personaId_createdAt_idx`(`personaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PersonaCambio` ADD CONSTRAINT `PersonaCambio_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
