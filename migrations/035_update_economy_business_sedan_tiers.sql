-- Migration: 035_update_economy_business_sedan_tiers.sql
-- Description: Updates economy sedan (id=1) and business sedan (id=2) to tiered pricing.

-- Economy Sedan (id=1)
--   Distance: $65 flat first mile, $2.85/mi next 20 miles, $2.55/mi remaining
--   Hourly:   $120 flat first hour (minimum), $70/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 65.00,
    per_mile       = 2.85,
    per_hour       = 120.00,
    per_minute     = 2.00,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 65.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 2.85,  'type', 'per_mile'),
        JSON_OBJECT('rate', 2.55, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 120.00, 'type', 'flat', 'minimum', 'true'),
        JSON_OBJECT('rate', 70.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 1;

-- Business Sedan (id=2)
--   Distance: $75 flat first mile, $3.25/mi next 20 miles, $3.00/mi remaining
--   Hourly:   $180 flat first hour (minimum), $90/hr each additional hour
UPDATE vehicle_pricing SET
    base_rate      = 75.00,
    per_mile       = 3.25,
    per_hour       = 180.00,
    per_minute     = 3.00,
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 75.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 3.25,  'type', 'per_mile'),
        JSON_OBJECT('rate', 3.00, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 180.00, 'type', 'flat', 'minimum', 'true'),
        JSON_OBJECT('rate', 90.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 2;
