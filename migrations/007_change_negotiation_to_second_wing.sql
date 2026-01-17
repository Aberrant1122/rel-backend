-- Migration: 007_change_negotiation_to_second_wing.sql
-- Description: Change "Negotiation" stage to "Second Wing" in leads table
-- Date: 2025-01-22

-- First, update existing data from 'Negotiation' to 'Second Wing'
UPDATE leads SET stage = 'Second Wing' WHERE stage = 'Negotiation';

-- Alter the ENUM to replace 'Negotiation' with 'Second Wing'
ALTER TABLE leads MODIFY COLUMN stage ENUM('New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost') DEFAULT 'New';