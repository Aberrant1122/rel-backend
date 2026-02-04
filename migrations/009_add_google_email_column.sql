-- Ensure table exists first (schema from 006)
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    scope TEXT NULL,
    token_type VARCHAR(50) NULL,
    expiry_date BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_google_oauth_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_google_oauth_user_id (user_id),
    INDEX idx_google_oauth_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stored procedure to safely add google_email column if it doesn't exist
DROP PROCEDURE IF EXISTS add_google_email_column_if_not_exists;

DELIMITER $$

CREATE PROCEDURE add_google_email_column_if_not_exists()
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    DECLARE index_exists INT DEFAULT 0;
    
    -- Check if column exists
    SELECT COUNT(*) INTO column_exists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'google_oauth_tokens'
    AND COLUMN_NAME = 'google_email';
    
    -- Add column if it doesn't exist
    IF column_exists = 0 THEN
        ALTER TABLE google_oauth_tokens ADD COLUMN google_email VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id;
    END IF;
    
    -- Check if index exists
    SELECT COUNT(*) INTO index_exists
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'google_oauth_tokens'
    AND INDEX_NAME = 'idx_google_email';
    
    -- Add index if it doesn't exist
    IF index_exists = 0 THEN
        ALTER TABLE google_oauth_tokens ADD INDEX idx_google_email (google_email);
    END IF;
END$$

DELIMITER ;

-- Execute the stored procedure
CALL add_google_email_column_if_not_exists();

-- Drop the stored procedure after use
DROP PROCEDURE IF EXISTS add_google_email_column_if_not_exists;

