-- Migration: 001_google_oauth_tables.sql
-- Description: Create Google OAuth tables for user authentication
-- Date: 2025-01-22

-- Create google_oauth_tokens table
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Foreign key to users table (nullable for OAuth before user registration)
    user_id INT NULL,
    
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
    UNIQUE KEY unique_user_google_account (user_id, google_email),
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_google_email (google_email),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_created_at (created_at)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create meetings table for calendar functionality
CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Meeting details
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    
    -- Google Meet integration
    google_meet_link VARCHAR(500) NULL,
    google_event_id VARCHAR(255) NULL,
    
    -- Meeting organizer
    organizer_id INT NOT NULL,
    
    -- Lead association (optional)
    lead_id INT NULL,
    
    -- Meeting status
    status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_organizer_id (organizer_id),
    INDEX idx_lead_id (lead_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    INDEX idx_google_event_id (google_event_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create meeting_participants table for multiple participants
CREATE TABLE IF NOT EXISTS meeting_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Meeting reference
    meeting_id INT NOT NULL,
    
    -- Participant details
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NULL,
    
    -- Participant status
    status ENUM('invited', 'accepted', 'declined', 'tentative') DEFAULT 'invited',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    
    -- Unique constraint: one participant per meeting
    UNIQUE KEY unique_meeting_participant (meeting_id, email),
    
    -- Indexes
    INDEX idx_meeting_id (meeting_id),
    INDEX idx_email (email),
    INDEX idx_status (status)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci