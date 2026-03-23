-- Migration: 018_create_reservations_table.sql
-- Description: Create reservations table (depends on users, vehicles, drivers)

CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_number VARCHAR(50) NOT NULL UNIQUE,
    booking_type ENUM('form', 'contract', 'manual') NOT NULL,
    trip_type ENUM('hourly', 'distance', 'contract') NOT NULL,
    
    -- Passenger Information
    passenger_id INT NOT NULL,
    passenger_name VARCHAR(255) NOT NULL,
    passenger_email VARCHAR(255) NOT NULL,
    passenger_phone VARCHAR(20) NOT NULL,
    
    -- Trip Details
    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    pickup_time TIME NOT NULL,
    vehicle_type_id INT NOT NULL,
    passenger_count INT DEFAULT 1,
    luggage_count INT DEFAULT 0,
    
    -- Booking Details
    price DECIMAL(10,2) NOT NULL,
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    reservation_status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    
    -- Assignment
    assigned_driver_id INT NULL,
    assigned_vehicle_id INT NULL,
    
    -- Metadata
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (passenger_id) REFERENCES users(id),
    FOREIGN KEY (vehicle_type_id) REFERENCES vehicles(id),
    FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Indexes
    INDEX idx_reservation_number (reservation_number),
    INDEX idx_passenger_id (passenger_id),
    INDEX idx_status (reservation_status),
    INDEX idx_pickup_date (pickup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;