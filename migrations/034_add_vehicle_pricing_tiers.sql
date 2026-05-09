-- Migration: 034_add_vehicle_pricing_tiers.sql
-- Description: Adds tiered pricing columns to vehicle_pricing and seeds electric vehicle tiers.
--              Vehicles without tiers continue to use flat base_rate/per_mile/per_hour as before.

SET @add_distance_tiers = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vehicle_pricing'
       AND COLUMN_NAME = 'distance_tiers') = 0,
    'ALTER TABLE vehicle_pricing ADD COLUMN distance_tiers JSON NULL',
    'SELECT 1'
);
PREPARE stmt FROM @add_distance_tiers;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_hourly_tiers = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vehicle_pricing'
       AND COLUMN_NAME = 'hourly_tiers') = 0,
    'ALTER TABLE vehicle_pricing ADD COLUMN hourly_tiers JSON NULL',
    'SELECT 1'
);
PREPARE stmt FROM @add_hourly_tiers;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Electric vehicle (id=4) tiered rates:
--   Distance: $90 flat first mile, $2.80/mi for next 20 miles, $2.50/mi remaining
--   Hourly:   $150 flat first hour (minimum), $80/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 90.00,
    per_mile       = 2.80,
    per_hour       = 150.00,
    per_minute     = 2.50,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 90.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 2.80,  'type', 'per_mile'),
        JSON_OBJECT('rate', 2.50, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 150.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 80.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 4;
