-- AlterTable
ALTER TABLE `persona` MODIFY `cadera` DOUBLE NULL,
    MODIFY `cintura` DOUBLE NULL;

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `user_username_key` TO `User_username_key`;
