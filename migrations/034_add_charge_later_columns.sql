-- Support for "Book Now, Charge Later" functionality
-- Adding columns to store Stripe customer, payment method, and scheduling details

ALTER TABLE form_bookings
  MODIFY COLUMN payment_status ENUM('pending', 'scheduled', 'processing', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
  ADD COLUMN stripe_payment_method_id VARCHAR(255) NULL,
  ADD COLUMN scheduled_charge_date DATE NULL,
  ADD COLUMN charge_retry_count INT DEFAULT 0,
  ADD COLUMN payment_intent_id VARCHAR(255) NULL;

ALTER TABLE reservations
  MODIFY COLUMN payment_status ENUM('pending', 'scheduled', 'processing', 'paid', 'failed', 'refunded') DEFAULT 'pending';
