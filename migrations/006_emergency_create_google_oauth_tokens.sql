-- Migration: 006_emergency_create_google_oauth_tokens.sql
-- Description: Emergency creation of google_oauth_tokens table for Railway
-- Date: 2025-01-22

-- Force drop any existing table with wrong schema
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