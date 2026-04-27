-- Add passenger_id to form_bookings to link it to a user
ALTER TABLE form_bookings
  ADD COLUMN passenger_id INT NULL,
  ADD CONSTRAINT fk_form_bookings_passenger FOREIGN KEY (passenger_id) REFERENCES users(id) ON DELETE SET NULL;
