/**
 * Fix Google OAuth Table - Add missing google_email column
 * Run this script to fix the existing google_oauth_tokens table
 */

const { pool } = require('./src/config/database');

async function fixGoogleOAuthTable() {
    console.log('🔧 Fixing google_oauth_tokens table...');
    
    try {
        // Check if google_email column exists
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'google_oauth_tokens' 
            AND COLUMN_NAME = 'google_email'
        `);
        
        if (columns.length === 0) {
            console.log('📝 Adding missing google_email column...');
            
            // Add the missing google_email column
            await pool.execute(`
                ALTER TABLE google_oauth_tokens 
                ADD COLUMN google_email VARCHAR(255) NULL 
                AFTER user_id
            `);
            
            console.log('✅ google_email column added successfully!');
        } else {
            console.log('✅ google_email column already exists');
        }
        
        // Show current table structure
        console.log('\n📋 Current table structure:');
        const [tableStructure] = await pool.execute('DESCRIBE google_oauth_tokens');
        tableStructure.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
        });
        
        console.log('\n🎉 Google OAuth table is now ready!');
        
    } catch (error) {
        console.error('❌ Failed to fix google_oauth_tokens table:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the fix
if (require.main === module) {
    fixGoogleOAuthTable()
        .then(() => {
            console.log('✅ Table fix completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Table fix failed:', error.message);
            process.exit(1);
        });
}

module.exports = { fixGoogleOAuthTable };