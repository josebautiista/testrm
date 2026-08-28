-- AlterTable
-- Ejercicio.id pasa a AUTO_INCREMENT (C-02). MySQL no permite modificar una
-- columna referenciada por una FK directamente (error 1833), así que se
-- retiran las FKs, se modifica la columna y se vuelven a crear idénticas.
ALTER TABLE `macrociclosemanaejercicio` DROP FOREIGN KEY `MacrocicloSemanaEjercicio_ejercicioId_fkey`;
ALTER TABLE `resultadoejercicio` DROP FOREIGN KEY `ResultadoEjercicio_ejercicioId_fkey`;

ALTER TABLE `ejercicio` MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT;

ALTER TABLE `macrociclosemanaejercicio` ADD CONSTRAINT `MacrocicloSemanaEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `resultadoejercicio` ADD CONSTRAINT `ResultadoEjercicio_ejercicioId_fkey` FOREIGN KEY (`ejercicioId`) REFERENCES `ejercicio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
