#!/usr/bin/env node

/**
 * Database Setup Script
 * Creates the database if it doesn't exist and tests the connection
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    console.log('🔄 Setting up database...');
    
    // Check if DATABASE_URL is provided (Railway/production)
    if (process.env.DATABASE_URL) {
        console.log('📍 Using DATABASE_URL for connection');
        
        try {
            // Test connection with DATABASE_URL
            const connection = await mysql.createConnection(process.env.DATABASE_URL);
            console.log('✅ Connected to database via DATABASE_URL');
            
            // Test a simple query
            await connection.execute('SELECT 1');
            console.log('✅ Database connection successful');
            
            await connection.end();
            
            console.log('\n🎉 Database setup completed successfully!');
            console.log('You can now run: npm run migrate');
            
        } catch (error) {
            console.error('❌ Database setup failed:', error.message);
            console.error('\n🔧 Troubleshooting:');
            console.error('1. Check your DATABASE_URL environment variable');
            console.error('2. Ensure the database server is accessible');
            console.error('3. Verify the DATABASE_URL format: mysql://user:password@host:port/database');
            process.exit(1);
        }
    } else {
        // Fallback to individual environment variables (local development)
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306
        };

        const dbName = process.env.DB_NAME || 'fortune-crm';

        console.log('📍 Using individual DB environment variables');
        console.log(`📍 Host: ${config.host}:${config.port}`);
        console.log(`👤 User: ${config.user}`);
        console.log(`🗄️  Database: ${dbName}`);

        try {
            // Connect without specifying database
            const connection = await mysql.createConnection(config);
            console.log('✅ Connected to MySQL server');

            // Create database if it doesn't exist
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            console.log(`✅ Database '${dbName}' ready`);

            // Close connection and reconnect to the specific database
            await connection.end();
            
            // Test connection to the specific database
            const dbConnection = await mysql.createConnection({
                ...config,
                database: dbName
            });
            
            console.log('✅ Database connection successful');
            await dbConnection.end();
            
            console.log('\n🎉 Database setup completed successfully!');
            console.log('You can now run: npm run migrate');
            
        } catch (error) {
            console.error('❌ Database setup failed:', error.message);
            console.error('\n🔧 Troubleshooting:');
            console.error('1. Make sure MySQL is running');
            console.error('2. Check your .env file database credentials');
            console.error('3. Ensure the MySQL user has CREATE DATABASE privileges');
            console.error('4. Verify the port number (default: 3306)');
            console.error('5. For Railway deployment, use DATABASE_URL instead');
            process.exit(1);
        }
    }
}

setupDatabase();