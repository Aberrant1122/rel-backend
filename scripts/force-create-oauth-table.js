#!/usr/bin/env node

/**
 * Force create google_oauth_tokens table
 * Emergency script for Railway deployment
 */

require('dotenv').config();
const { pool, testConnection } = require('../src/config/database');

async function forceCreateOAuthTable() {
    console.log('🚨 Emergency: Force creating google_oauth_tokens table...');
    
    try {
        // Test connection
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Database connection failed');
        }

        // Drop existing table if it has wrong schema
        console.log('🔄 Dropping existing table (if any)...');
        await pool.execute('DROP TABLE IF EXISTS google_oauth_tokens');

        // Create table with correct schema
        console.log('🔄 Creating google_oauth_tokens table...');
        await pool.execute(`
            CREATE TABLE google_oauth_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NULL,
                scope TEXT NULL,
                token_type VARCHAR(50) NULL,
                expiry_date BIGINT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_google_oauth_user_id 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_google_oauth_user_id (user_id),
                INDEX idx_google_oauth_expiry (expiry_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Verify table was created
        const [rows] = await pool.execute(
            "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'google_oauth_tokens'"
        );

        if (rows[0].count > 0) {
            console.log('✅ google_oauth_tokens table created successfully!');
            
            // Show table structure
            const [columns] = await pool.execute('DESCRIBE google_oauth_tokens');
            console.log('\n📋 Table structure:');
            columns.forEach(col => {
                console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'} ${col.Key ? `[${col.Key}]` : ''}`);
            });
        } else {
            throw new Error('Table creation verification failed');
        }

        console.log('\n🎉 Emergency table creation completed!');
        console.log('💡 Google OAuth endpoints should now work properly.');
        
    } catch (error) {
        console.error('❌ Emergency table creation failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

forceCreateOAuthTable();