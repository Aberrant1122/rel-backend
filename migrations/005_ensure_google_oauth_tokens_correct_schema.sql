-- Migration: 005_ensure_google_oauth_tokens_correct_schema.sql
-- Description: Ensure google_oauth_tokens table has correct schema for Railway deployment
-- Date: 2025-01-22

-- Create table with correct schema (idempotent)
-- This will only create if table doesn't exist, or recreate with correct schema
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
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
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci