-- Migration: 014_add_assigned_to_tasks.sql
-- Description: Add assigned_to column to tasks table for task assignment feature

DELIMITER $$

DROP PROCEDURE IF EXISTS add_assigned_to_column$$

CREATE PROCEDURE add_assigned_to_column()
BEGIN
    -- Add assigned_to column if it doesn't exist
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tasks' 
        AND COLUMN_NAME = 'assigned_to'
    ) THEN
        ALTER TABLE tasks ADD COLUMN assigned_to INT NULL AFTER user_id;
    END IF;

    -- Add index if it doesn't exist
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'tasks' 
        AND INDEX_NAME = 'idx_assigned_to'
    ) THEN
        CREATE INDEX idx_assigned_to ON tasks(assigned_to);
    END IF;
END$$

DELIMITER ;

CALL add_assigned_to_column();
DROP PROCEDURE IF EXISTS add_assigned_to_column;
