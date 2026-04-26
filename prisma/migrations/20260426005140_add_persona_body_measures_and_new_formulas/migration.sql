/*
  Warnings:

  - You are about to drop the column `porcentajeMasa` on the `ejercicio` table. All the data in the column will be lost.
  - Added the required column `porcentajeMasaHombre` to the `Ejercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `porcentajeMasaMujer` to the `Ejercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cadera` to the `Persona` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cintura` to the `Persona` table without a default value. This is not possible if the table is not empty.
  - Added the required column `casas` to the `ResultadoEjercicio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nacleiro` to the `ResultadoEjercicio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ejercicio` ADD COLUMN `porcentajeMasaHombre` DOUBLE NULL,
    ADD COLUMN `porcentajeMasaMujer` DOUBLE NULL;

UPDATE `ejercicio`
SET `porcentajeMasaHombre` = `porcentajeMasa`,
    `porcentajeMasaMujer` = `porcentajeMasa`;

ALTER TABLE `ejercicio`
    MODIFY COLUMN `porcentajeMasaHombre` DOUBLE NOT NULL,
    MODIFY COLUMN `porcentajeMasaMujer` DOUBLE NOT NULL,
    DROP COLUMN `porcentajeMasa`;

-- AlterTable
ALTER TABLE `persona` ADD COLUMN `cadera` DOUBLE NULL,
    ADD COLUMN `cintura` DOUBLE NULL;

UPDATE `persona`
SET `cadera` = 0,
    `cintura` = 0;

ALTER TABLE `persona`
    MODIFY COLUMN `cadera` DOUBLE NOT NULL,
    MODIFY COLUMN `cintura` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `resultadoejercicio` ADD COLUMN `casas` DOUBLE NULL,
    ADD COLUMN `nacleiro` DOUBLE NULL;

UPDATE `resultadoejercicio`
SET `casas` = 0,
    `nacleiro` = 0;

ALTER TABLE `resultadoejercicio`
    MODIFY COLUMN `casas` DOUBLE NOT NULL,
    MODIFY COLUMN `nacleiro` DOUBLE NOT NULL;
