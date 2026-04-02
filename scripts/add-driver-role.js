const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDriverRoleToUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'rel_dashboard'
    });

    try {
        console.log('Adding "driver" role to users table ENUM...');
        
        await connection.query(`
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('user', 'admin', 'passenger', 'driver') DEFAULT 'user'
        `);

        console.log('✅ Successfully added "driver" role to users table');
    } catch (error) {
        console.error('❌ Error adding driver role:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run the migration
addDriverRoleToUsers()
    .then(() => {
        console.log('Migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
