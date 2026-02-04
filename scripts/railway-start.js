#!/usr/bin/env node

/**
 * Railway-specific startup script
 * Handles database migrations and server startup for Railway deployment
 */

require('dotenv').config();
const { testConnection } = require('../src/config/database');
const MigrationRunner = require('../src/utils/migrationRunner');

async function railwayStart() {
    console.log('🚀 Railway startup process initiated...');
    
    // Wait for database to be available (Railway can take time)
    console.log('⏳ Waiting for database to be ready...');
    let dbReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (!dbReady && attempts < maxAttempts) {
        try {
            dbReady = await testConnection();
            if (!dbReady) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
                if (attempts % 5 === 0) {
                    console.log(`⏳ Still waiting for database... (${attempts}/${maxAttempts})`);
                }
            }
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
    }
    
    if (dbReady) {
        console.log('✅ Database is ready!');
        
        // Emergency role fix first (critical for user creation)
        console.log('🚨 Running emergency role fix...');
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'crm_auth_db',
                port: process.env.DB_PORT || 3306
            });

            // Check if users table exists
            const [tables] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users'
            `);
            
            if (tables[0].count > 0) {
                // Check current role column definition
                const [columns] = await connection.execute(`
                    SELECT COLUMN_TYPE, COLUMN_DEFAULT
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'users'
                    AND COLUMN_NAME = 'role'
                `);
                
                if (columns.length > 0) {
                    const columnType = columns[0].COLUMN_TYPE;
                    // Check if 'employee' is already in the ENUM
                    if (!columnType.includes("'employee'")) {
                        console.log('🔧 Updating role column to include employee...');
                        await connection.execute(`
                            ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee'
                        `);
                        console.log('✅ Role column updated successfully');
                    } else {
                        console.log('✅ Role column already supports employee');
                    }
                } else {
                    console.log('⚠️  Role column not found, will be created with correct definition');
                }
            } else {
                console.log('⚠️  Users table does not exist yet, will be created with correct definition');
            }
            
            await connection.end();
            console.log('✅ Emergency role fix completed');
        } catch (error) {
            console.warn('⚠️  Emergency role fix failed:', error.message);
            console.warn('💡 Continuing startup anyway...');
        }
        
        // Run migrations
        console.log('🔄 Running database migrations...');
        try {
            const migrationRunner = new MigrationRunner();
            await migrationRunner.runMigrations();
            console.log('✅ Migrations completed successfully');
        } catch (error) {
            console.warn('⚠️  Migration failed:', error.message);
            
            // Check if it's the known duplicate column issue
            if (error.message.includes('Duplicate column name')) {
                console.warn('🔧 Detected duplicate column issue. Run hotfix script:');
                console.warn('   node scripts/railway-hotfix.js');
            }
            
            console.warn('💡 Server will continue starting. Migrations can be run later.');
        }
    } else {
        console.warn('⚠️  Database not ready after waiting. Starting server anyway...');
    }
    
    // Start the main server
    console.log('🚀 Starting main server...');
    require('../server.js');
}

// Only run if this script is executed directly
if (require.main === module) {
    railwayStart().catch(error => {
        console.error('❌ Railway startup failed:', error);
        // Still try to start the server
        require('../server.js');
    });
}

module.exports = railwayStart;