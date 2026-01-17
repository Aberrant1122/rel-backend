-- Migration: 008_fix_stage_enum_second_wing.sql
-- Description: Fix ENUM to properly replace Negotiation with Second Wing
-- Date: 2025-01-22

-- Update any remaining 'Negotiation' records to 'Second Wing'
UPDATE leads SET stage = 'Second Wing' WHERE stage = 'Negotiation';

-- Drop and recreate the ENUM with the correct values
ALTER TABLE leads MODIFY COLUMN stage ENUM('New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost') DEFAULT 'New';