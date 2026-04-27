-- Add stripe_customer_id to users table for recurring/later payments
ALTER TABLE users
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL;
