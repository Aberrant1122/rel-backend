-- Web form: payment lifecycle + link reservations to form booking_ref (Stripe client_reference_id)

ALTER TABLE form_bookings
  ADD COLUMN payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending' AFTER status;

ALTER TABLE form_bookings
  ADD COLUMN stripe_session_id VARCHAR(255) NULL AFTER payment_status;

ALTER TABLE reservations
  ADD COLUMN form_booking_ref VARCHAR(100) NULL COMMENT 'Matches form_bookings.booking_ref (Stripe client_reference_id)';

CREATE INDEX idx_reservations_form_booking_ref ON reservations(form_booking_ref);
