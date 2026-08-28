-- AlterTable
ALTER TABLE `Persona` ADD COLUMN `faseEntrenamiento` VARCHAR(191) NULL,
    ADD COLUMN `faseInicioAt` DATETIME(3) NULL,
    ADD COLUMN `nivelOverride` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ResultadoEjercicio` ADD COLUMN `pesoEquipo` DOUBLE NOT NULL DEFAULT 0;
