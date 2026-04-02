-- Migration: 030_fix_user_roles_final.sql
-- Description: Ensures the users table role column includes 'passenger', 'driver', and 'affiliate'.

-- This is a critical fix for the 'Data truncated for column \'role\' at row 1' error.
ALTER TABLE users 
MODIFY COLUMN role ENUM('user', 'employee', 'admin', 'passenger', 'driver', 'affiliate') 
DEFAULT 'employee';

-- Optional: If there are existing records that might have 'user' but should be 'employee'
UPDATE users SET role = 'employee' WHERE role = 'user';
