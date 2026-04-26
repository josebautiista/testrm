SET @has_cintura = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Persona'
    AND COLUMN_NAME = 'cintura'
);

SET @has_cadera = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Persona'
    AND COLUMN_NAME = 'cadera'
);

SET @optional_sql = IF(
  @has_cintura = 1 AND @has_cadera = 1,
  'ALTER TABLE `Persona` MODIFY `cintura` DOUBLE NULL, MODIFY `cadera` DOUBLE NULL',
  'SELECT 1'
);

PREPARE stmt_optional_persona FROM @optional_sql;
EXECUTE stmt_optional_persona;
DEALLOCATE PREPARE stmt_optional_persona;
