// scripts/create-driver.js
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

async function createDriver() {
    try {
        const name = process.argv[2] || 'Test Driver';
        const email = process.argv[3] || 'driver@test.com';
        const phone = process.argv[4] || '+1234567890';
        const license = process.argv[5] || 'DL123456';
        
        const password = 'Driver@123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        const [userResult] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, "driver")',
            [name, email, hashedPassword, phone]
        );
        
        const userId = userResult.insertId;
        
        // Insert driver
        await pool.execute(
            'INSERT INTO drivers (user_id, license_number, status) VALUES (?, ?, "available")',
            [userId, license]
        );
        
        console.log(`✅ Driver created successfully!`);
        console.log(`   Name: ${name}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   License: ${license}`);
        
    } catch (error) {
        console.error('Error creating driver:', error);
    } finally {
        process.exit(0);
    }
}

createDriver();