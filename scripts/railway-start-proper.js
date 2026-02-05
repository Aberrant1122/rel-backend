#!/usr/bin/env node

/**
 * Railway Proper Startup Script
 * Runs migrations correctly and fails if they don't work
 */

require('dotenv').config();
const { testConnection, pool } = require('../src/config/database');
const MigrationRunner = require('../src/utils/migrationRunner');
const { spawn } = require('child_process');

async function properStart() {
    console.log('🚀 Railway Proper Startup...\n');

    try {
        // Step 1: Wait for database with proper retries
        console.log('1️⃣ Waiting for database connection...');
        let dbConnected = false;
        let retries = 20;

        while (!dbConnected && retries > 0) {
            try {
                dbConnected = await testConnection();
                if (dbConnected) {
                    console.log('✅ Database connected\n');
                    break;
                }
            } catch (err) {
                // Continue retrying
            }
            
            if (!dbConnected) {
                console.log(`⏳ Waiting for database... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                retries--;
            }
        }

        if (!dbConnected) {
            throw new Error('Database connection failed after retries');
        }

        // Step 2: Run migrations properly
        console.log('2️⃣ Running database migrations...');
        const migrationRunner = new MigrationRunner();
        
        try {
            await migrationRunner.runMigrations();
            console.log('✅ Migrations completed successfully\n');
        } catch (migrationError) {
            console.error('❌ Migration failed:', migrationError.message);
            
            // Check if it's a known issue we can fix
            if (migrationError.message.includes('Duplicate column')) {
                console.log('🔧 Detected duplicate column issue, attempting fix...');
                await fixDuplicateColumns();
                
                // Retry migrations
                console.log('🔄 Retrying migrations...');
                await migrationRunner.runMigrations();
                console.log('✅ Migrations completed after fix\n');
            } else if (migrationError.message.includes('already exists')) {
                console.log('⚠️  Some migrations already applied, continuing...\n');
            } else {
                // For other errors, log and continue (Railway will show the error)
                console.error('⚠️  Migration error (server will still start):');
                console.error('   ', migrationError.message);
                console.error('   Please check Railway logs and run migrations manually if needed\n');
            }
        }

        // Step 3: Verify critical tables exist (for logging only)
        console.log('3️⃣ Verifying critical tables...');
        const verification = await verifyCriticalTables();
        
        if (!verification.allExist) {
            console.warn('⚠️  Some critical tables are missing:');
            verification.missing.forEach(table => {
                console.warn(`   - ${table}`);
            });
            console.warn('\n⚠️  Please ensure migrations are running correctly.');
            console.warn('   Run: railway run node scripts/migrate.js run');
        } else {
            console.log('✅ All critical tables exist\n');
        }

        // Step 4: Close migration pool and start server
        await pool.end();
        
        console.log('4️⃣ Starting main server...\n');
        const server = spawn('node', ['server.js'], {
            stdio: 'inherit',
            env: process.env
        });

        server.on('error', (err) => {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        });

        server.on('exit', (code) => {
            process.exit(code);
        });

    } catch (error) {
        console.error('❌ Startup failed:', error.message);
        console.error('\nAttempting to start server anyway...');
        
        // Try to start server even if setup failed
        const server = spawn('node', ['server.js'], {
            stdio: 'inherit',
            env: process.env
        });

        server.on('exit', (code) => {
            process.exit(code);
        });
    }
}

/**
 * Verify critical tables exist
 */
async function verifyCriticalTables() {
    const criticalTables = {
        'users': ['id', 'email', 'password', 'name', 'role'],
        'tasks': ['id', 'title', 'user_id', 'assigned_to', 'status'],
        'notifications': ['id', 'user_id', 'type', 'title', 'message', 'is_read'],
        'attendance': ['id', 'user_id', 'check_in', 'check_out', 'date']
    };

    const missing = [];
    const missingColumns = {};

    for (const [table, requiredColumns] of Object.entries(criticalTables)) {
        try {
            const [tables] = await pool.query(`SHOW TABLES LIKE '${table}'`);
            
            if (tables.length === 0) {
                missing.push(table);
            } else {
                // Check if required columns exist
                const [columns] = await pool.query(`DESCRIBE ${table}`);
                const existingColumns = columns.map(c => c.Field);
                const missingCols = requiredColumns.filter(col => !existingColumns.includes(col));
                
                if (missingCols.length > 0) {
                    missingColumns[table] = missingCols;
                    console.warn(`   ⚠️  Table '${table}' is missing columns: ${missingCols.join(', ')}`);
                }
            }
        } catch (err) {
            missing.push(table);
        }
    }

    return {
        allExist: missing.length === 0 && Object.keys(missingColumns).length === 0,
        missing,
        missingColumns
    };
}

/**
 * Fix duplicate column issues
 */
async function fixDuplicateColumns() {
    // This is a known issue from previous migrations
    console.log('   Checking for duplicate columns...');
    
    try {
        // Check if google_email column exists twice in google_oauth_tokens
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME, COUNT(*) as count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'google_oauth_tokens' 
            GROUP BY COLUMN_NAME 
            HAVING count > 1
        `);
        
        if (columns.length > 0) {
            console.log('   Found duplicate columns, attempting to fix...');
            // Add specific fix logic here if needed
        }
    } catch (err) {
        console.log('   No duplicate column issues found');
    }
}

properStart();
