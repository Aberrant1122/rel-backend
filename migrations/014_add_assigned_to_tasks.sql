-- Migration: 014_add_assigned_to_tasks.sql
-- Description: Add assigned_to column to tasks table for task assignment feature

-- Check if column doesn't exist before adding
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS assigned_to INT NULL AFTER user_id;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_assigned_to ON tasks(assigned_to);
