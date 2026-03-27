-- Migration: 016_create_form_configuration_tables.sql
-- Description: Creates tables for vehicles, pricing, rate configuration, and SQL-based bookings.

-- Temporarily drop foreign key from drivers table if it exists
SET @foreign_key_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'drivers' 
    AND CONSTRAINT_NAME = 'drivers_ibfk_2'
);

SET @sql = IF(@foreign_key_exists > 0,
    'ALTER TABLE drivers DROP FOREIGN KEY drivers_ibfk_2',
    'SELECT "Foreign key does not exist" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vehicles table (drop and recreate with correct schema)
DROP TABLE IF EXISTS vehicles;
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

-- Vehicle Pricing table
CREATE TABLE IF NOT EXISTS vehicle_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    base_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    per_mile DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    per_hour DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    per_minute DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    UNIQUE KEY (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vehicle Service Classes mapping
CREATE TABLE IF NOT EXISTS vehicle_service_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    service_class ENUM('hourly', 'airport', 'event', 'corporate') NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    UNIQUE KEY (vehicle_id, service_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Global Rate Configuration
CREATE TABLE IF NOT EXISTS form_rate_config (
    id INT PRIMARY KEY DEFAULT 1,
    tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0879, -- 8.79%
    cc_fee_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0375, -- 3.75%
    gratuity_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.2000, -- 20%
    service_multipliers JSON, -- e.g., {"hourly": 1.0, "airport": 1.1, "event": 1.15, "corporate": 1.2}
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bookings table (to replace Firebase)
CREATE TABLE IF NOT EXISTS form_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_ref VARCHAR(50) NOT NULL UNIQUE,
    service_class VARCHAR(50),
    event_type VARCHAR(100),
    hours INT,
    vehicle_type VARCHAR(100),
    pickup_location TEXT,
    dropoff_location TEXT,
    pickup_date DATE,
    pickup_time TIME,
    passengers INT,
    flight_number VARCHAR(100),
    notes TEXT,
    reference_code VARCHAR(100),
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    total_amount DECIMAL(10, 2),
    tax_amount DECIMAL(10, 2),
    gratuity_amount DECIMAL(10, 2),
    cc_fee_amount DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending',
    raw_data JSON, -- Stores the full multi-step form data for backup/audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial vehicles
INSERT IGNORE INTO vehicles (id, slug, label, passenger_capacity, luggage_capacity, description, features) VALUES
(1, 'economy-sedan', 'Economy Sedan', 4, 2, 'Comfortable and affordable sedan for everyday travel', '["Leather seats", "Climate control", "Bluetooth audio", "USB charging"]'),
(2, 'business-sedan', 'Business Sedan', 4, 2, 'Premium sedan for business travelers', '["Premium leather seats", "Dual-zone climate", "Wi-Fi hotspot", "Privacy glass", "Newspaper/magazine"]'),
(3, 'first-class', 'First Class', 3, 2, 'Luxury vehicle for special occasions', '["Premium leather interior", "Chauffeur service", "Complimentary beverages", "Privacy partition", "Ambient lighting"]'),
(4, 'electric', 'Electric', 5, 2, 'Eco-friendly luxury electric vehicle', '["Zero emissions", "Quiet ride", "Advanced tech features", "Regenerative braking", "Premium sound system"]'),
(5, 'mercedes-sprinter', 'Mercedes Sprinter (Van)', 10, 8, 'Spacious luxury van for groups', '["Seats up to 10 passengers", "Climate control", "Bluetooth audio", "USB charging ports", "Luggage space"]'),
(6, 'jet-sprinter', 'Jet Sprinter (Van)', 10, 8, 'Ultra-luxury sprinter with premium amenities', '["Premium leather seating", "Mini bar", "Entertainment system", "Privacy features", "Flight tracking"]'),
(7, 'mini-van', 'Mini Van', 8, 6, 'Comfortable van for small groups', '["Seats up to 8 passengers", "Air conditioning", "Audio system", "Ample luggage space"]'),
(8, 'first-class-suv', 'First Class SUV', 6, 4, 'Luxury SUV with premium features', '["Premium leather seats", "Advanced safety features", "Panoramic roof", "Premium audio", "Off-road capability"]'),
(9, 'suv', 'SUV', 6, 4, 'Spacious SUV for families and groups', '["Seats up to 6 passengers", "All-wheel drive", "Climate control", "Bluetooth audio", "Cargo space"]'),
(10, 'stretch-8', '8 Passenger Stretch', 8, 4, 'Elegant stretch limousine for special events', '["Seats up to 8 passengers", "Premium bar", "Fiber optic lighting", "Multiple TV screens", "Privacy partition"]');

-- Seed initial pricing
INSERT IGNORE INTO vehicle_pricing (vehicle_id, base_rate, per_mile, per_hour, per_minute) VALUES
(1, 50, 2.50, 85, 1.42),
(2, 65, 2.85, 120, 2.00),
(3, 100, 4.50, 150, 2.50),
(4, 70, 3.00, 130, 2.17),
(5, 150, 5.50, 200, 3.33),
(6, 160, 5.80, 220, 3.67),
(7, 120, 4.80, 180, 3.00),
(8, 110, 4.20, 160, 2.67),
(9, 85, 3.50, 140, 2.33),
(10, 180, 6.50, 250, 4.17);

-- Seed service classes
-- Mapping airport service (subset)
INSERT IGNORE INTO vehicle_service_classes (vehicle_id, service_class) VALUES
(1, 'hourly'), (1, 'airport'), (1, 'event'), (1, 'corporate'),
(2, 'hourly'), (2, 'airport'), (2, 'event'), (2, 'corporate'),
(3, 'hourly'), (3, 'airport'), (3, 'event'), (3, 'corporate'),
(4, 'hourly'), (4, 'airport'), (4, 'event'), (4, 'corporate'),
(5, 'hourly'), (5, 'event'), (5, 'corporate'),
(6, 'hourly'), (6, 'event'), (6, 'corporate'),
(7, 'hourly'), (7, 'event'), (7, 'corporate'),
(8, 'hourly'), (8, 'airport'), (8, 'event'), (8, 'corporate'),
(9, 'hourly'), (9, 'airport'), (9, 'event'), (9, 'corporate'),
(10, 'hourly'), (10, 'event'), (10, 'corporate');

-- Seed global rate config
INSERT IGNORE INTO form_rate_config (id, tax_rate, cc_fee_rate, gratuity_rate, service_multipliers) VALUES
(1, 0.0879, 0.0375, 0.2000, '{"hourly": 1.0, "airport": 1.1, "event": 1.15, "corporate": 1.2}');

-- Re-add foreign key constraint to drivers table if it was dropped
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
