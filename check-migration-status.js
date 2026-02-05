#!/usr/bin/env node

/**
 * Check Migration Status
 * Diagnose why migrations aren't running
 */

require('dotenv').config();
const { pool } = require('./src/config/database');
const MigrationRunner = require('./src/utils/migrationRunner');

async function checkStatus() {
    console.log('🔍 Checking Migration Status...\n');

    try {
        // Test connection
        console.log('1️⃣ Testing database connection...');
        await pool.query('SELECT 1');
        console.log('   ✅ Database connected\n');

        // Check if migrations table exists
        console.log('2️⃣ Checking migrations table...');
        try {
            const [tables] = await pool.query("SHOW TABLES LIKE 'schema_migrations'");
            if (tables.length > 0) {
                console.log('   ✅ Migrations table exists');
                
                // Show executed migrations
                const [migrations] = await pool.query('SELECT * FROM schema_migrations ORDER BY executed_at');
                console.log(`   📋 Executed migrations: ${migrations.length}`);
                migrations.forEach(m => {
                    console.log(`      - ${m.filename} (${m.executed_at})`);
                });
            } else {
                console.log('   ❌ Migrations table does NOT exist');
                console.log('   💡 This means migrations have NEVER run successfully');
            }
        } catch (err) {
            console.log('   ❌ Error checking migrations table:', err.message);
        }
        console.log('');

        // Check migration files
        console.log('3️⃣ Checking migration files...');
        const migrationRunner = new MigrationRunner();
        const status = await migrationRunner.getMigrationStatus();
        
        console.log(`   📁 Total migration files: ${status.total}`);
        console.log(`   ✅ Executed: ${status.executed}`);
        console.log(`   ⏳ Pending: ${status.pending}`);
        
        if (status.pending > 0) {
            console.log('\n   ⚠️  Pending migrations:');
            status.pendingMigrations.forEach(m => {
                console.log(`      - ${m}`);
            });
        }
        console.log('');

        // Check critical tables
        console.log('4️⃣ Checking critical tables...');
        const criticalTables = ['users', 'tasks', 'notifications', 'attendance'];
        
        for (const table of criticalTables) {
            try {
                const [tables] = await pool.query(`SHOW TABLES LIKE '${table}'`);
                if (tables.length > 0) {
                    // Check columns
                    const [columns] = await pool.query(`DESCRIBE ${table}`);
                    console.log(`   ✅ ${table} (${columns.length} columns)`);
                    
                    // Check specific columns
                    if (table === 'tasks') {
                        const hasAssignedTo = columns.some(c => c.Field === 'assigned_to');
                        if (hasAssignedTo) {
                            console.log(`      ✅ Has assigned_to column`);
                        } else {
                            console.log(`      ❌ Missing assigned_to column`);
                        }
                    }
                } else {
                    console.log(`   ❌ ${table} does NOT exist`);
                }
            } catch (err) {
                console.log(`   ❌ ${table}: ${err.message}`);
            }
        }
        console.log('');

        // Summary
        console.log('5️⃣ Summary:');
        const allTablesExist = await checkAllTables();
        const migrationsRan = status.executed > 0;
        const hasPending = status.pending > 0;

        if (allTablesExist && !hasPending) {
            console.log('   ✅ Everything looks good!');
        } else {
            console.log('   ⚠️  Issues detected:');
            if (!migrationsRan) {
                console.log('      - Migrations have never run');
            }
            if (hasPending) {
                console.log(`      - ${status.pending} pending migrations`);
            }
            if (!allTablesExist) {
                console.log('      - Some critical tables are missing');
            }
            
            console.log('\n   💡 Recommended actions:');
            console.log('      1. Run: node railway-quick-fix.js');
            console.log('      2. Or deploy with new start script');
            console.log('      3. Check Railway logs for errors');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nPossible causes:');
        console.error('- Database not accessible');
        console.error('- Wrong credentials');
        console.error('- Network issues');
        process.exit(1);
    }
}

async function checkAllTables() {
    const criticalTables = ['users', 'tasks', 'notifications', 'attendance'];
    let allExist = true;
    
    for (const table of criticalTables) {
        try {
            const [tables] = await pool.query(`SHOW TABLES LIKE '${table}'`);
            if (tables.length === 0) {
                allExist = false;
            }
        } catch (err) {
            allExist = false;
        }
    }
    
    return allExist;
}

checkStatus();
