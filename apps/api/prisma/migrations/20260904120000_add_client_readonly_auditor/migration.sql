-- AlterEnum: Client Read Only + Auditor
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'client_readonly';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'auditor';
