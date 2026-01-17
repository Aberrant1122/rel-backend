-- WhatsApp Integration Schema for CRM
-- Run this after the main schema.sql

USE crm_auth_db;

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    phone VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    stage ENUM('New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost') DEFAULT 'New',
    source ENUM('WhatsApp', 'Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Other') DEFAULT 'WhatsApp',
    last_message TEXT,
    last_message_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_stage (stage),
    INDEX idx_source (source),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead messages table (WhatsApp message history)
CREATE TABLE IF NOT EXISTS lead_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    message_id VARCHAR(255),
    direction ENUM('inbound', 'outbound') NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_id (lead_id),
    INDEX idx_message_id (message_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead timeline table (activity tracking)
CREATE TABLE IF NOT EXISTS lead_timeline (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    event_type ENUM('message_received', 'message_sent', 'stage_changed', 'note_added', 'call_made', 'email_sent') NOT NULL,
    description TEXT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_id (lead_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
