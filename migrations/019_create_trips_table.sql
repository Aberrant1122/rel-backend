-- Migration: 019_create_trips_table.sql
-- Description: Create trips table for tracking active trips
-- Author: REL Dashboard
-- Date: 2024-03-19

-- Up Migration
-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL UNIQUE,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    status ENUM('assigned', 'accepted', 'started', 'completed', 'cancelled') DEFAULT 'assigned',
    start_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    actual_pickup_location TEXT,
    actual_dropoff_location TEXT,
    distance_traveled DECIMAL(10,2),
    duration_minutes INT,
    wait_time_minutes INT DEFAULT 0,
    notes TEXT,
    driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
    passenger_rating INT CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    
    -- Indexes for performance
    INDEX idx_driver_id (driver_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    INDEX idx_completed (end_time, status)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose StatementEnd

-- Down Migration
-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS trips;

-- +goose StatementEnd