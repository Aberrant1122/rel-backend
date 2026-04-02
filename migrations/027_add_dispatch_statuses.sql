-- Migration: 027_add_dispatch_statuses.sql
-- Description: Add pending_driver_approval and driver_denied to reservation_status enum

ALTER TABLE reservations 
  MODIFY COLUMN reservation_status 
    ENUM('pending', 'pending_driver_approval', 'assigned', 'driver_denied', 'in_progress', 'completed', 'cancelled', 'rejected') 
    DEFAULT 'pending';
