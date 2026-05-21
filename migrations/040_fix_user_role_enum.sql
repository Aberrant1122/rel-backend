-- Fix role ENUM to include 'user' and 'passenger', and fix existing empty roles
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','driver','dispatcher','user','passenger') DEFAULT 'user';

UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';
