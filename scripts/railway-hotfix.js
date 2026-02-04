#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runHotfix() {
    console.log('🚀 Starting Railway hotfix...');
    
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

        // Mark problematic migration as completed to skip it
        console.log('📝 Marking migration 009 as completed...');
        await connection.execute(`
            INSERT IGNORE INTO schema_migrations (filename, executed_at) 
            VALUES ('009_add_google_email_column.sql', NOW())
        `);

        // Run the hotfix migration
        console.log('🔧 Running hotfix migration...');
        const hotfixPath = path.join(__dirname, '../migrations/012_hotfix_duplicate_column_and_roles.sql');
        const hotfixSQL = await fs.readFile(hotfixPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = hotfixSQL.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                } catch (error) {
                    // Log but don't fail on expected errors
                    console.log(`⚠️  Statement warning: ${error.message}`);
                }
            }
        }

        // Mark hotfix as completed
        await connection.execute(`
            INSERT IGNORE INTO schema_migrations (filename, executed_at) 
            VALUES ('012_hotfix_duplicate_column_and_roles.sql', NOW())
        `);

        console.log('✅ Hotfix completed successfully');
        console.log('🔄 You can now restart your Railway deployment');

    } catch (error) {
        console.error('❌ Hotfix failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runHotfix();