#!/usr/bin/env node

/**
 * Database Migration Script
 * Usage: npm run migrate [status]
 */

require('dotenv').config();
const MigrationRunner = require('../src/utils/migrationRunner');

async function main() {
    const command = process.argv[2] || 'run';
    const migrationRunner = new MigrationRunner();

    try {
        switch (command) {
            case 'run':
                await migrationRunner.runMigrations();
                break;
                
            case 'status':
                const status = await migrationRunner.getMigrationStatus();
                console.log('\n📊 Migration Status:');
                console.log(`   Total migrations: ${status.total}`);
                console.log(`   Executed: ${status.executed}`);
                console.log(`   Pending: ${status.pending}`);
                
                if (status.executedMigrations.length > 0) {
                    console.log('\n✅ Executed migrations:');
                    status.executedMigrations.forEach(migration => {
                        console.log(`   - ${migration}`);
                    });
                }
                
                if (status.pendingMigrations.length > 0) {
                    console.log('\n⏳ Pending migrations:');
                    status.pendingMigrations.forEach(migration => {
                        console.log(`   - ${migration}`);
                    });
                }
                break;
                
            default:
                console.log('Usage: npm run migrate [run|status]');
                console.log('  run    - Execute pending migrations (default)');
                console.log('  status - Show migration status');
                process.exit(1);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();