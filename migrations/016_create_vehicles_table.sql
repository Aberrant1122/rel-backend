-- Migration: 016_create_vehicles_table.sql
-- Description: Create vehicles table (no dependencies)

CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_code VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(100) NOT NULL,
    passenger_capacity INT NOT NULL,
    luggage_capacity INT NOT NULL,
    description TEXT,
    hourly_rate DECIMAL(10,2),
    base_fare DECIMAL(10,2),
    per_mile_rate DECIMAL(10,2),
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;