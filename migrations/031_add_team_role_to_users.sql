-- Migration: 031_add_team_role_to_users.sql
-- Description: Ensures the users table role column includes the 'team' role correctly.

-- Fix for "Data truncated for column 'role' at row 1" when creating Team members.
ALTER TABLE users 
MODIFY COLUMN role ENUM('user', 'employee', 'admin', 'team', 'passenger', 'driver', 'affiliate') 
DEFAULT 'employee';

-- Make sure anyone accidentally given empty or misassigned team role is recovered
UPDATE users SET role = 'team' WHERE role = '';
