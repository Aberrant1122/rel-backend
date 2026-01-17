-- Migration: 004_recreate_google_oauth_tokens_correct_schema.sql
-- Description: Recreate google_oauth_tokens table with correct schema (user_id NOT NULL UNIQUE)
-- Date: 2025-01-22

-- Backup any existing data (if table exists)
CREATE TABLE IF NOT EXISTS google_oauth_tokens_backup AS 
SELECT * FROM google_oauth_tokens WHERE 1=0;

-- Insert existing data into backup (if any exists)
INSERT IGNORE INTO google_oauth_tokens_backup 
SELECT * FROM google_oauth_tokens WHERE user_id IS NOT NULL;

-- Drop the existing table
DROP TABLE IF EXISTS google_oauth_tokens;

-- Create google_oauth_tokens table with correct schema
CREATE TABLE google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- User association (NOT NULL and UNIQUE as per requirements)
    user_id INT NOT NULL UNIQUE,
    
    -- OAuth tokens (access_token is required)
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    scope TEXT NULL,
    token_type VARCHAR(50) NULL,
    
    -- Token expiry (using BIGINT for Unix timestamp)
    expiry_date BIGINT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint (assumes users table exists)
    CONSTRAINT fk_google_oauth_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_google_oauth_user_id (user_id),
    INDEX idx_google_oauth_expiry (expiry_date)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Restore data from backup (if any)
INSERT IGNORE INTO google_oauth_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, created_at, updated_at)
SELECT user_id, access_token, refresh_token, scope, token_type, expiry_date, created_at, updated_at 
FROM google_oauth_tokens_backup 
WHERE user_id IS NOT NULL;

-- Clean up backup table
DROP TABLE IF EXISTS google_oauth_tokens_backup;