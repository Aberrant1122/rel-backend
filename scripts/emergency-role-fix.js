#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function emergencyRoleFix() {
    console.log('🚨 Emergency role fix starting...');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crm_auth_db',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('✅ Database connected');

        // Check current role column definition
        const [columns] = await connection.execute(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'role'
        `);

        console.log('📋 Current role column:', columns[0]?.COLUMN_TYPE || 'Not found');

        // Fix role column to support employee
        console.log('🔧 Fixing role column...');
        await connection.execute(`
            ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee'
        `);

        // Verify the fix
        const [newColumns] = await connection.execute(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'role'
        `);

        console.log('✅ Role column fixed:', newColumns[0]?.COLUMN_TYPE);

        // Test creating a user with employee role
        console.log('🧪 Testing user creation...');
        try {
            await connection.execute(`
                INSERT INTO users (name, email, password, role) 
                VALUES ('Test User', 'test@example.com', 'test123', 'employee')
                ON DUPLICATE KEY UPDATE name = VALUES(name)
            `);
            console.log('✅ User creation test passed');
            
            // Clean up test user
            await connection.execute(`DELETE FROM users WHERE email = 'test@example.com'`);
        } catch (testError) {
            console.error('❌ User creation test failed:', testError.message);
        }

        console.log('🎉 Emergency role fix completed successfully');

    } catch (error) {
        console.error('❌ Emergency fix failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

emergencyRoleFix();