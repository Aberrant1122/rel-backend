require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306
    };

    console.log('Testing connection with config:', {
        host: config.host,
        user: config.user,
        password: config.password ? '***' : '(empty)',
        port: config.port
    });

    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connection successful!');
        
        // Test creating database
        const dbName = process.env.DB_NAME || 'fortune-crm';
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Database '${dbName}' created/exists`);
        
        await connection.end();
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.code, error.message);
        return false;
    }
}

testConnection();