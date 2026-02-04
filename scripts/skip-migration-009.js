#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function skipMigration009() {
    console.log('🚀 Skipping problematic migration 009...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crm_auth_db',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('✅ Database connected');

        // Create migrations table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_filename (filename)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Mark migration 009 as completed
        await connection.execute(`
            INSERT IGNORE INTO schema_migrations (filename, executed_at) 
            VALUES ('009_add_google_email_column.sql', NOW())
        `);

        console.log('✅ Migration 009 marked as completed');

        // Check if google_email column exists, add if missing
        const [columns] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'google_oauth_tokens'
            AND COLUMN_NAME = 'google_email'
        `);

        if (columns[0].count === 0) {
            console.log('🔧 Adding missing google_email column...');
            await connection.execute(`
                ALTER TABLE google_oauth_tokens 
                ADD COLUMN google_email VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id
            `);
            await connection.execute(`
                ALTER TABLE google_oauth_tokens 
                ADD INDEX idx_google_email (google_email)
            `);
            console.log('✅ google_email column added');
        } else {
            console.log('✅ google_email column already exists');
        }

        console.log('🎉 Migration 009 issue resolved');

    } catch (error) {
        console.error('❌ Failed to skip migration:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

skipMigration009();