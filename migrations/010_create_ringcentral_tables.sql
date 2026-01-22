-- RingCentral Integration Tables
-- Migration: 010_create_ringcentral_tables.sql

-- RingCentral OAuth Tokens
CREATE TABLE IF NOT EXISTS ringcentral_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT,
    account_id VARCHAR(255),
    extension_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    UNIQUE KEY unique_user_ringcentral (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calls (Cloud Phone)
CREATE TABLE IF NOT EXISTS calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    call_id VARCHAR(255) UNIQUE NOT NULL,
    direction ENUM('Inbound', 'Outbound') NOT NULL,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    status VARCHAR(50),
    duration INT DEFAULT 0,
    start_time DATETIME,
    end_time DATETIME,
    recording_url TEXT,
    recording_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_call_id (call_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages (SMS/MMS)
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    direction ENUM('Inbound', 'Outbound') NOT NULL,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    subject VARCHAR(500),
    message_text TEXT,
    message_type ENUM('SMS', 'MMS') DEFAULT 'SMS',
    attachment_count INT DEFAULT 0,
    read_status ENUM('Read', 'Unread') DEFAULT 'Unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_created_at (created_at),
    INDEX idx_direction (direction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message Attachments (for MMS)
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    attachment_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(500),
    content_type VARCHAR(100),
    file_size INT,
    file_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team Messages (Chat)
CREATE TABLE IF NOT EXISTS team_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    group_id VARCHAR(255),
    group_name VARCHAR(500),
    sender_id VARCHAR(255),
    sender_name VARCHAR(255),
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'TextMessage',
    attachments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_group_id (group_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Video Meetings
CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    meeting_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(500),
    start_time DATETIME,
    duration INT,
    join_url TEXT,
    host_join_url TEXT,
    password VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Scheduled',
    participant_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_meeting_id (meeting_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook Events (Audit Trail)
CREATE TABLE IF NOT EXISTS webhook_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    user_id INT,
    payload JSON,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

