-- AlterTable
ALTER TABLE `ejercicio` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `admitePorcentajeRm` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `enBateriaEvaluacion` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `equipamiento` VARCHAR(191) NOT NULL DEFAULT 'otro',
    ADD COLUMN `esDeTiempo` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `esUnilateral` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `incrementoMinimoKg` DOUBLE NOT NULL DEFAULT 2.5,
    ADD COLUMN `musculoPrimario` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `musculosSecundarios` JSON NULL,
    ADD COLUMN `patron` VARCHAR(191) NOT NULL DEFAULT 'accesorio';

-- CreateIndex
CREATE INDEX `Ejercicio_patron_idx` ON `Ejercicio`(`patron`);
