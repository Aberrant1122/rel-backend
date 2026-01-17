-- Google OAuth Accounts Schema
-- This table stores Google OAuth credentials for users
-- Supports multiple Google accounts per user with proper constraints

USE crm_auth_db;

-- Create google_oauth_accounts table (renamed from google_oauth_tokens for clarity)
CREATE TABLE IF NOT EXISTS google_oauth_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Foreign key to users table
    user_id INT NOT NULL,
    
    -- Google account information
    google_email VARCHAR(255) NOT NULL,
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT NULL,
    
    -- Token expiry (stored as DATETIME for easier queries)
    expiry_date DATETIME NULL,
    
    -- Account management
    is_primary BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint with cascade delete
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint: one Google account per user (prevents duplicates)
    UNIQUE KEY unique_user_google_account (user_id, google_email),
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_google_email (google_email),
    INDEX idx_is_primary (is_primary),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_created_at (created_at)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: If google_oauth_tokens table exists, migrate data
-- This is a safe migration that preserves existing data
INSERT IGNORE INTO google_oauth_accounts 
    (user_id, google_email, access_token, refresh_token, token_type, scope, expiry_date, created_at, updated_at)
SELECT 
    user_id, 
    google_email, 
    access_token, 
    refresh_token, 
    COALESCE(token_type, 'Bearer') as token_type,
    scope, 
    expiry_date,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM google_oauth_tokens 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_oauth_tokens' AND table_schema = DATABASE());

-- Set primary account for users who only have one Google account
UPDATE google_oauth_accounts 
SET is_primary = TRUE 
WHERE user_id IN (
    SELECT user_id 
    FROM (
        SELECT user_id 
        FROM google_oauth_accounts 
        GROUP BY user_id 
        HAVING COUNT(*) = 1
    ) as single_account_users
) AND is_primary = FALSE;


