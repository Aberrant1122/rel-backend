-- Migration: 036_update_first_class_sprinters_tiers.sql
-- Description: Updates First Class (id=3), Mercedes Sprinter (id=5), and Jet Sprinter (id=6) to tiered pricing.

-- First Class (id=3)
--   Distance: $180 flat first mile, $8.00/mi next 20 miles, $4.00/mi remaining
--   Hourly:   $200 flat first hour (minimum), $145/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 180.00,
    per_mile       = 8.00,
    per_hour       = 200.00,
    per_minute     = 3.33,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 180.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 8.00,   'type', 'per_mile'),
        JSON_OBJECT('rate', 4.00, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 200.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 145.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 3;

-- Mercedes Sprinter Van (id=5)
--   Distance: $400 flat first mile, $5.00/mi next 20 miles, $5.00/mi remaining
--   Hourly:   $575 flat first hour (minimum), $185/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 400.00,
    per_mile       = 5.00,
    per_hour       = 575.00,
    per_minute     = 9.58,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 400.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 5.00,   'type', 'per_mile'),
        JSON_OBJECT('rate', 5.00, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 575.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 185.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 5;

-- Jet Sprinter Van (id=6)
--   Distance: $550 flat first mile, $6.00/mi next 20 miles, $6.00/mi remaining
--   Hourly:   $750 flat first hour (minimum), $225/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 550.00,
    per_mile       = 6.00,
    per_hour       = 750.00,
    per_minute     = 12.50,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 550.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 6.00,   'type', 'per_mile'),
        JSON_OBJECT('rate', 6.00, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 750.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 225.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 6;
