-- Migration for Google OAuth Integration
-- Creates google_oauth_tokens table (for backward compatibility with existing code)
-- This matches the table name your current code expects

USE crm_auth_db;

-- Create the table your code is expecting
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Foreign key to users table
    user_id INT NULL, -- Nullable to support OAuth before user registration
    
    -- Google account information  
    google_email VARCHAR(255) NOT NULL,
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT NULL,
    
    -- Token expiry
    expiry_date DATETIME NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint (with NULL support)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint: one Google account per user
    -- Uses partial unique index to handle NULL user_id
    UNIQUE KEY unique_user_google_account (user_id, google_email),
    
    -- Unique constraint for google_email when user_id is NULL
    -- This prevents duplicate Google accounts during OAuth flow
    UNIQUE KEY unique_google_email_no_user (google_email, (CASE WHEN user_id IS NULL THEN 1 ELSE NULL END)),
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_google_email (google_email),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_created_at (created_at)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;