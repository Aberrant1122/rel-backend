SET @add_reset_token = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'password_reset_token') = 0,
    'ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @add_reset_token;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_reset_expires = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'password_reset_expires') = 0,
    'ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL',
    'SELECT 1'
);
PREPARE stmt FROM @add_reset_expires;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
