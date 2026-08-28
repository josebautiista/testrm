-- AlterTable
-- Ejercicio.id pasa a AUTO_INCREMENT (C-02). MySQL no permite modificar una
-- columna referenciada por una FK directamente (error 1833), así que se
-- retiran las FKs, se modifica la columna y se vuelven a crear idénticas.
ALTER TABLE `MacrocicloSemanaEjercicio` DROP FOREIGN KEY `MacrocicloSemanaEjercicio_ejercicioId_fkey`;
ALTER TABLE `ResultadoEjercicio` DROP FOREIGN KEY `ResultadoEjercicio_ejercicioId_fkey`;

ALTER TABLE `Ejercicio` MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;

ALTER TABLE `MacrocicloSemanaEjercicio` ADD CONSTRAINT `MacrocicloSemanaEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ResultadoEjercicio` ADD CONSTRAINT `ResultadoEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `Ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
