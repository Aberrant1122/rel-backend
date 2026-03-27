-- Migration: 018_fix_vehicles_table_schema.sql
-- Description: Fixes the vehicles table schema by adding missing columns (slug, sort_order, features)
-- This migration handles the case where the table already exists with an old schema

-- Disable foreign key checks to allow renaming/recreating tables with references
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Drop foreign key from drivers table temporarily
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'drivers' 
    AND CONSTRAINT_NAME = 'drivers_ibfk_2'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE drivers DROP FOREIGN KEY drivers_ibfk_2',
    'SELECT "Foreign key does not exist" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Check if vehicles already has the new schema (slug column)
SET @already_updated = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'vehicles' 
    AND COLUMN_NAME = 'slug'
);

-- Wrap Step 2-4 in conditional execution via dynamic SQL
-- If already updated, we skip the rename and recreate
SET @rename_and_recreate = IF(@already_updated = 0,
    "BEGIN; 
     DROP TABLE IF EXISTS vehicles_old_backup;
     RENAME TABLE vehicles TO vehicles_old_backup;
     CREATE TABLE vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        passenger_capacity INT NOT NULL DEFAULT 4,
        luggage_capacity INT NOT NULL DEFAULT 2,
        description TEXT,
        features JSON,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    COMMIT;",
    'SELECT "Table already updated with slug, skipping recreate" AS message'
);

-- Note: We can't use BEGIN/COMMIT in PREPARE, so we separate them or just run them sequentially.
-- Actually, we can just use IF(condition, 'actual sql', 'select skip') for each step.

SET @rename_sql = IF(@already_updated = 0,
    'RENAME TABLE vehicles TO vehicles_old_backup',
    'SELECT "Skipping rename" AS message'
);
PREPARE rename_stmt FROM @rename_sql;
EXECUTE rename_stmt;
DEALLOCATE PREPARE rename_stmt;

SET @create_sql = IF(@already_updated = 0,
    'CREATE TABLE vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        passenger_capacity INT NOT NULL DEFAULT 4,
        luggage_capacity INT NOT NULL DEFAULT 2,
        description TEXT,
        features JSON,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT "Skipping create" AS message'
);
PREPARE create_stmt FROM @create_sql;
EXECUTE create_stmt;
DEALLOCATE PREPARE create_stmt;

-- Step 4: Migrate data from old table if columns exist
-- Try to copy what we can from the old table
SET @has_vehicle_code = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'vehicles_old_backup' 
    AND COLUMN_NAME = 'vehicle_code'
);

SET @migrate_sql = IF(@has_vehicle_code > 0,
    "INSERT INTO vehicles (id, slug, label, passenger_capacity, luggage_capacity, description, is_active)
     SELECT id, vehicle_code, vehicle_type, passenger_capacity, luggage_capacity, description, is_active 
     FROM vehicles_old_backup",
    'SELECT "No old data to migrate" AS message'
);

PREPARE migrate_stmt FROM @migrate_sql;
EXECUTE migrate_stmt;
DEALLOCATE PREPARE migrate_stmt;

-- Step 5: Re-add foreign key to drivers table
SET @fk_check = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'drivers' 
    AND CONSTRAINT_NAME = 'drivers_ibfk_2'
);

SET @add_fk_sql = IF(@fk_check = 0,
    'ALTER TABLE drivers ADD CONSTRAINT drivers_ibfk_2 FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL',
    'SELECT "Foreign key already exists" AS message'
);

PREPARE add_fk_stmt FROM @add_fk_sql;
EXECUTE add_fk_stmt;
DEALLOCATE PREPARE add_fk_stmt;

-- Note: Old table vehicles_old_backup is kept for safety. Can be dropped manually after verification.

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
