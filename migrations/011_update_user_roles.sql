-- Migration: 011_update_user_roles.sql
-- Description: Ensures the users table role column supports 'employee' and defaults to it.

-- 1. Modify the role column to include 'employee'
-- We include 'user' for backwards compatibility if the table was initially created with it.
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee';

-- 2. Update any records using the old 'user' role to 'employee'
UPDATE users SET role = 'employee' WHERE role = 'user';

-- 3. Set the default to 'employee' explicitly
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';
