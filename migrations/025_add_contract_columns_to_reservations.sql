-- Add missing contract columns to reservations table if they don't exist
SET @dbname = DATABASE();

-- Add contract_start_date
SET @col = 'contract_start_date';
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'reservations' AND COLUMN_NAME = @col) > 0,
  'SELECT 1', 'ALTER TABLE reservations ADD COLUMN contract_start_date DATE NULL'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add contract_end_date
SET @col = 'contract_end_date';
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'reservations' AND COLUMN_NAME = @col) > 0,
  'SELECT 1', 'ALTER TABLE reservations ADD COLUMN contract_end_date DATE NULL'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add daily_rate
SET @col = 'daily_rate';
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'reservations' AND COLUMN_NAME = @col) > 0,
  'SELECT 1', 'ALTER TABLE reservations ADD COLUMN daily_rate DECIMAL(10,2) NULL'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add hourly_rate
SET @col = 'hourly_rate';
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'reservations' AND COLUMN_NAME = @col) > 0,
  'SELECT 1', 'ALTER TABLE reservations ADD COLUMN hourly_rate DECIMAL(10,2) NULL'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
