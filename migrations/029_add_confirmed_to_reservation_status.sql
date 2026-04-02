-- Migration: 029_add_confirmed_to_reservation_status.sql
-- Description: Add 'confirmed' to reservation_status enum

ALTER TABLE reservations 
  MODIFY COLUMN reservation_status 
    ENUM('pending', 'pending_driver_approval', 'assigned', 'confirmed', 'driver_denied', 'in_progress', 'completed', 'cancelled', 'rejected') 
    DEFAULT 'pending';
