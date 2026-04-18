-- Add nullable idempotency keys for session and admin OTP submissions.
ALTER TABLE `AdminOtp`
  ADD COLUMN `requestId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `AdminOtp_requestId_key`(`requestId`);

ALTER TABLE `Sesion`
  ADD COLUMN `requestId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Sesion_requestId_key`(`requestId`);
