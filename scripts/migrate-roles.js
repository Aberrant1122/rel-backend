const { pool } = require('../src/config/database');

async function migrateRoles() {
    try {
        console.log('🚀 Starting role migration...');

        // 1. Update the role ENUM in the users table
        console.log('Updating role ENUM column...');
        await pool.query(`
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee'
        `);

        // 2. Update existing 'user' roles to 'employee'
        console.log('Migrating existing "user" roles to "employee"...');
        const [result] = await pool.query(`
            UPDATE users SET role = 'employee' WHERE role = 'user'
        `);
        console.log(`✅ Migrated ${result.affectedRows} users.`);

        // 3. (Optional) Remove 'user' from ENUM if no longer needed
        // Note: Doing this in one step might be safer after verifying data
        console.log('Cleaning up ENUM column...');
        await pool.query(`
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('employee', 'admin') DEFAULT 'employee'
        `);

        console.log('✅ Role migration completed successfully!');
    } catch (error) {
        console.error('❌ Error during role migration:', error);
    } finally {
        process.exit();
    }
}

migrateRoles();
