-- Migration: 038_update_minivan_stretch_tiers.sql
-- Description: Updates Mini Van (id=7) and 8 Passenger Stretch (id=10) to tiered pricing
--              using existing flat rates (no rate changes, structure only).

-- Mini Van (id=7)
--   Existing: base_rate=120, per_mile=4.80, per_hour=180, per_minute=3.00
UPDATE vehicle_pricing SET
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 120.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 4.80,   'type', 'per_mile'),
        JSON_OBJECT('rate', 4.80, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 180.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 180.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 7;

-- 8 Passenger Stretch (id=10)
--   Existing: base_rate=180, per_mile=6.50, per_hour=250, per_minute=4.17
UPDATE vehicle_pricing SET
    distance_tiers = JSON_ARRAY(
        JSON_OBJECT('miles', 1,  'rate', 180.00, 'type', 'flat'),
        JSON_OBJECT('miles', 20, 'rate', 6.50,   'type', 'per_mile'),
        JSON_OBJECT('rate', 6.50, 'type', 'per_mile')
    ),
    hourly_tiers = JSON_ARRAY(
        JSON_OBJECT('hours', 1, 'rate', 250.00, 'type', 'flat', 'minimum', CAST(TRUE AS JSON)),
        JSON_OBJECT('rate', 250.00, 'type', 'per_hour')
    )
WHERE vehicle_id = 10;
