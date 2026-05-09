-- Migration: 037_update_first_class_suv_suv_tiers.sql
-- Description: Updates First Class SUV (id=8) and SUV (id=9) to tiered pricing.

-- First Class SUV (id=8)
--   Distance: $165 flat first mile, $4.50/mi next 20 miles, $3.75/mi remaining
--   Hourly:   $200 flat first hour (minimum), $140/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 165.00,
    per_mile       = 4.50,
    per_hour       = 200.00,
    per_minute     = 3.33,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 165.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 4.50,   'type', 'per_mile'),
        JSON_OBJECT('rate', 3.75, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 200.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 140.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 8;

-- SUV (id=9)
--   Distance: $105 flat first mile, $3.75/mi next 20 miles, $3.25/mi remaining
--   Hourly:   $180 flat first hour (minimum), $120/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 105.00,
    per_mile       = 3.75,
    per_hour       = 180.00,
    per_minute     = 3.00,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 105.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 3.75,   'type', 'per_mile'),
        JSON_OBJECT('rate', 3.25, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 180.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 120.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 9;
