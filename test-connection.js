require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...\n');
    
    // Test with DATABASE_URL
    if (process.env.DATABASE_URL) {
        console.log('📌 Using DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
        try {
            const connection = await mysql.createConnection(process.env.DATABASE_URL);
            console.log('✅ DATABASE_URL connection successful');
            await connection.ping();
            console.log('✅ Database ping successful');
            await connection.end();
        } catch (error) {
            console.error('❌ DATABASE_URL connection failed:', error.message);
        }
    }
    
    // Test with individual variables
    console.log('\n📌 Using individual variables:');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   Port: ${process.env.DB_PORT}`);
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        console.log('✅ Individual variables connection successful');
        await connection.ping();
        console.log('✅ Database ping successful');
        
        // Test a simple query
        const [rows] = await connection.query('SELECT 1 + 1 AS result');
        console.log('✅ Query test successful:', rows);
        
        await connection.end();
        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('❌ Individual variables connection failed:', error.message);
        console.error('\n💡 Troubleshooting tips:');
        console.error('   1. Make sure MySQL is running on port', process.env.DB_PORT);
        console.error('   2. Verify database "' + process.env.DB_NAME + '" exists');
        console.error('   3. Check user "' + process.env.DB_USER + '" has proper permissions');
        console.error('   4. If using XAMPP/WAMP, ensure MySQL service is started');
    }
}

testDatabaseConnection();
