-- AlterTable
ALTER TABLE `Persona` ADD COLUMN `entrenadorId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Persona_entrenadorId_idx` ON `Persona`(`entrenadorId`);

-- AddForeignKey
ALTER TABLE `Persona` ADD CONSTRAINT `Persona_entrenadorId_fkey` FOREIGN KEY (`entrenadorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
