ALTER TABLE `Ejercicio`
  ADD COLUMN `esEjercicioLibre` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Ejercicio_esEjercicioLibre_nombre_idx`
  ON `Ejercicio`(`esEjercicioLibre`, `nombre`);
