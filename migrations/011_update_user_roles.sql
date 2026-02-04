-- Migration: Update user roles to include 'employee'
-- Description: Modifies the users table role column to allow 'employee' and 'admin' (and optionally 'user' for backwards compatibility during migration)

-- Step 1: Modify the role column to include 'employee'
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee';

-- Step 2: Update any existing 'user' roles to 'employee' if needed
UPDATE users SET role = 'employee' WHERE role = 'user';

-- Step 3: Set default to 'employee' if it wasn't already
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';

-- Step 4: (Optional cleanup) Re-modify to only include what we want, but 'user' is safer to keep for now if there are dependencies
-- ALTER TABLE users MODIFY COLUMN role ENUM('employee', 'admin') DEFAULT 'employee';
