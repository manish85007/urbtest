-- Add Operations Manager role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'operations' BEFORE 'factory';
