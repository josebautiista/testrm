-- AlterTable
ALTER TABLE `persona` ADD COLUMN `faseEntrenamiento` VARCHAR(191) NULL,
    ADD COLUMN `faseInicioAt` DATETIME(3) NULL,
    ADD COLUMN `nivelOverride` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `resultadoejercicio` ADD COLUMN `pesoEquipo` DOUBLE NOT NULL DEFAULT 0;
