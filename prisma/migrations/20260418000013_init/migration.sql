-- CreateTable
CREATE TABLE `Persona` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cc` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `sexo` VARCHAR(191) NOT NULL,
    `masaCorporal` DOUBLE NOT NULL,
    `edad` INTEGER NOT NULL,
    `talla` DOUBLE NOT NULL,
    `entrenado` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Persona_cc_key`(`cc`),
    INDEX `Persona_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ejercicio` (
    `id` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `porcentajeMasa` DOUBLE NOT NULL,

    INDEX `Ejercicio_nombre_idx`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sesion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `personaId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Sesion_personaId_createdAt_idx`(`personaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResultadoEjercicio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesionId` INTEGER NOT NULL,
    `ejercicioId` INTEGER NOT NULL,
    `repeticiones` INTEGER NOT NULL,
    `carga` DOUBLE NOT NULL,
    `epley` DOUBLE NOT NULL,
    `brzycki` DOUBLE NOT NULL,
    `lombardi` DOUBLE NOT NULL,
    `lander` DOUBLE NOT NULL,
    `oconnor` DOUBLE NOT NULL,
    `mayhew` DOUBLE NOT NULL,
    `wathen` DOUBLE NOT NULL,
    `baechle` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResultadoEjercicio_sesionId_createdAt_idx`(`sesionId`, `createdAt`),
    INDEX `ResultadoEjercicio_ejercicioId_idx`(`ejercicioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sesion` ADD CONSTRAINT `Sesion_personaId_fkey` FOREIGN KEY (`personaId`) REFERENCES `Persona`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultadoEjercicio` ADD CONSTRAINT `ResultadoEjercicio_sesionId_fkey` FOREIGN KEY (`sesionId`) REFERENCES `Sesion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResultadoEjercicio` ADD CONSTRAINT `ResultadoEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
