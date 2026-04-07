-- Migration: 033_add_enabled_service_types.sql
-- Description: Adds enabled_service_types column to form_rate_config table.

ALTER TABLE form_rate_config ADD COLUMN enabled_service_types JSON DEFAULT NULL AFTER service_multipliers;

-- Seed initial value
UPDATE form_rate_config SET enabled_service_types = '["hourly", "airport", "event", "corporate"]' WHERE id = 1;
