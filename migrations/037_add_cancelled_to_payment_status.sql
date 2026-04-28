-- Add 'cancelled' to the payment_status ENUM for both tables
-- This fixes the "Data truncated" error when deleting or cancelling reservations

ALTER TABLE form_bookings
  MODIFY COLUMN payment_status ENUM('pending', 'scheduled', 'processing', 'paid', 'failed', 'refunded', 'cancelled') DEFAULT 'pending';

ALTER TABLE reservations
  MODIFY COLUMN payment_status ENUM('pending', 'scheduled', 'processing', 'paid', 'failed', 'refunded', 'cancelled') DEFAULT 'pending';
