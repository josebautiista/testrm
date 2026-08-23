-- CreateTable
CREATE TABLE `MesocicloCarga` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mesocicloId` INTEGER NOT NULL,
    `tiempoSesionMin` INTEGER NOT NULL,
    `direcciones` JSON NOT NULL,
    `volumen` JSON NOT NULL,
    `microciclos` JSON NOT NULL,
    `sesiones` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MesocicloCarga_mesocicloId_key`(`mesocicloId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MesocicloCarga` ADD CONSTRAINT `MesocicloCarga_mesocicloId_fkey` FOREIGN KEY (`mesocicloId`) REFERENCES `MacrocicloMesociclo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
