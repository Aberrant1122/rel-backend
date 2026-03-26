-- Migration: 022_add_contract_columns.sql
-- Description: Add contract columns to reservations table for existing installations

-- Up Migration
-- +goose Up
-- +goose StatementBegin

-- Add contract_start_date if not exists
SET @dbname = DATABASE();
SET @tablename = 'reservations';
SET @columnname = 'contract_start_date';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) = 0,
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATE NULL'),
    'SELECT 1'));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add contract_end_date if not exists
SET @columnname = 'contract_end_date';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) = 0,
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATE NULL'),
    'SELECT 1'));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add daily_rate if not exists
SET @columnname = 'daily_rate';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) = 0,
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NULL'),
    'SELECT 1'));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add hourly_rate if not exists
SET @columnname = 'hourly_rate';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) = 0,
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NULL'),
    'SELECT 1'));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- +goose StatementEnd

-- Down Migration
-- +goose Down
-- +goose StatementBegin

ALTER TABLE reservations DROP COLUMN contract_start_date;
ALTER TABLE reservations DROP COLUMN contract_end_date;
ALTER TABLE reservations DROP COLUMN daily_rate;
ALTER TABLE reservations DROP COLUMN hourly_rate;

-- +goose StatementEnd