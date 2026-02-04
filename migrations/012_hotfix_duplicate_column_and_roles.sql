-- Migration: 012_hotfix_duplicate_column_and_roles.sql
-- Description: Hotfix for Railway deployment issues
-- 1. Skip adding google_email if it already exists
-- 2. Ensure role column supports employee

-- Check if google_email column exists, add only if it doesn't
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'google_oauth_tokens'
    AND COLUMN_NAME = 'google_email'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE google_oauth_tokens ADD COLUMN google_email VARCHAR(255) NOT NULL DEFAULT \'\' AFTER user_id',
    'SELECT "google_email column already exists, skipping..." as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index only if column was added or doesn't exist
SET @index_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'google_oauth_tokens'
    AND INDEX_NAME = 'idx_google_email'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE google_oauth_tokens ADD INDEX idx_google_email (google_email)',
    'SELECT "idx_google_email index already exists, skipping..." as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix role column to support employee (critical for user creation)
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee';

-- Update any existing 'user' roles to 'employee'
UPDATE users SET role = 'employee' WHERE role = 'user';