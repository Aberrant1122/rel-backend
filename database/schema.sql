-- Create database if not exists
CREATE DATABASE IF NOT EXISTS crm_auth_db;
USE crm_auth_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin', 'passenger', 'driver') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token(255)),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;








-- CREATE DATABASE IF NOT EXISTS rel_dashboard;
-- USE rel_dashboard;

-- -- Users table
-- CREATE TABLE users (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     first_name VARCHAR(100) NOT NULL,
--     last_name VARCHAR(100) NOT NULL,
--     phone VARCHAR(20),
--     role ENUM('admin', 'team', 'driver', 'passenger', 'affiliate') NOT NULL,
--     is_active BOOLEAN DEFAULT true,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     INDEX idx_email (email),
--     INDEX idx_role (role)
-- );

-- Vehicles table
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_code VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL,
    passenger_capacity INT NOT NULL,
    luggage_capacity INT NOT NULL,
    description TEXT,
    hourly_rate DECIMAL(10,2),
    base_fare DECIMAL(10,2),
    per_mile_rate DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE drivers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    license_number VARCHAR(100),
    license_expiry DATE,
    vehicle_id INT,
    status ENUM('available', 'on_trip', 'off_duty', 'inactive') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    INDEX idx_status (status)
);

-- Reservations table
CREATE TABLE reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
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
    
    -- Contract specific
    contract_start_date DATE NULL,
    contract_end_date DATE NULL,
    daily_rate DECIMAL(10,2) NULL,
    hourly_rate DECIMAL(10,2) NULL,
    
    -- Metadata
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (passenger_id) REFERENCES users(id),
    FOREIGN KEY (vehicle_type_id) REFERENCES vehicles(id),
    FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_reservation_number (reservation_number),
    INDEX idx_passenger_id (passenger_id),
    INDEX idx_status (reservation_status),
    INDEX idx_pickup_date (pickup_date),
    INDEX idx_driver_id (assigned_driver_id)
);

-- Insert sample data
-- INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
-- ('admin@rel.com', '$2a$10$samplehash', 'Admin', 'User', '+1234567890', 'admin'),
-- ('team@rel.com', '$2a$10$samplehash', 'Team', 'Member', '+1234567891', 'team'),
-- ('john.doe@example.com', '$2a$10$samplehash', 'John', 'Doe', '+1234567892', 'passenger'),
-- ('mike.smith@example.com', '$2a$10$samplehash', 'Mike', 'Smith', '+1234567893', 'driver');

-- INSERT INTO vehicles (vehicle_code, vehicle_type, passenger_capacity, luggage_capacity, description, hourly_rate, base_fare, per_mile_rate) VALUES
-- ('SED001', 'Sedan', 4, 2, 'Comfortable sedan for up to 4 passengers', 50.00, 25.00, 2.50),
-- ('SUV001', 'SUV', 6, 4, 'Spacious SUV with extra luggage space', 75.00, 35.00, 3.00),
-- ('VAN001', 'Van', 10, 8, 'Large van for groups', 100.00, 50.00, 4.00);

-- INSERT INTO drivers (user_id, license_number, status) VALUES
-- (4, 'DL123456', 'available');