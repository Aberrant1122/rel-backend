#!/usr/bin/env node

/**
 * Create Migration Script
 * Usage: npm run create-migration "migration_name"
 */

const fs = require('fs').promises;
const path = require('path');

async function createMigration() {
    const migrationName = process.argv[2];
    
    if (!migrationName) {
        console.error('❌ Migration name is required');
        console.log('Usage: npm run create-migration "migration_name"');
        console.log('Example: npm run create-migration "add_user_preferences_table"');
        process.exit(1);
    }

    // Generate migration filename with timestamp
    const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');
    
    const filename = `${timestamp}_${migrationName.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const migrationsDir = path.join(__dirname, '../migrations');
    const filePath = path.join(migrationsDir, filename);

    // Create migrations directory if it doesn't exist
    try {
        await fs.mkdir(migrationsDir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }

    // Migration template
    const template = `-- Migration: ${filename}
-- Description: ${migrationName}
-- Date: ${new Date().toISOString().split('T')[0]}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remember to:
-- 1. Use IF NOT EXISTS for CREATE TABLE statements
-- 2. Add proper indexes for performance
-- 3. Use appropriate data types and constraints
-- 4. Include foreign key constraints where needed
`;

    try {
        await fs.writeFile(filePath, template);
        console.log(`✅ Migration created: ${filename}`);
        console.log(`📁 Location: ${filePath}`);
        console.log('\n📝 Next steps:');
        console.log('1. Edit the migration file to add your SQL statements');
        console.log('2. Run "npm run migrate" to execute the migration');
        console.log('3. Use "npm run migrate:status" to check migration status');
    } catch (error) {
        console.error('❌ Failed to create migration:', error.message);
        process.exit(1);
    }
}

createMigration();