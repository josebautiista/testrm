-- AlterTable
ALTER TABLE `Persona` ADD COLUMN `diasDisponibles` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `equipamiento` JSON NULL,
    ADD COLUMN `limitaciones` VARCHAR(191) NULL,
    ADD COLUMN `mesesEntrenamiento` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `minutosPorSesion` INTEGER NOT NULL DEFAULT 60;
