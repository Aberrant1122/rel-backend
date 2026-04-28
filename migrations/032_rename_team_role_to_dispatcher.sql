-- Migration: 032_rename_team_role_to_dispatcher.sql
-- Description: Renames the 'team' role to 'dispatcher' in the users table.

-- Add 'dispatcher' to the ENUM
ALTER TABLE users 
MODIFY COLUMN role ENUM('user', 'employee', 'admin', 'team', 'passenger', 'driver', 'affiliate', 'dispatcher') 
DEFAULT 'employee';

-- Update existing 'team' users to 'dispatcher'
UPDATE users SET role = 'dispatcher' WHERE role = 'team';

-- Now redefine the ENUM without 'team'
ALTER TABLE users 
MODIFY COLUMN role ENUM('user', 'employee', 'admin', 'dispatcher', 'passenger', 'driver', 'affiliate') 
DEFAULT 'employee';
