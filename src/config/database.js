const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool using DATABASE_URL
const poolConfig = process.env.DATABASE_URL ? {
    uri: process.env.DATABASE_URL,
    multipleStatements: true
} : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fortune-crm',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

const pool = mysql.createPool({
    ...poolConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Connection timeout settings
    connectTimeout: 60000, // 60 seconds
    acquireTimeout: 60000, // 60 seconds
    timeout: 60000, // 60 seconds
    // Handle connection errors
    maxIdle: 10, // max idle connections
    idleTimeout: 60000, // close idle connections after 60 seconds
    // Reconnection settings
    reconnect: true
});

// Handle pool errors
pool.on('connection', (connection) => {
    console.log('🔗 New database connection established');
    
    connection.on('error', (err) => {
        console.error('❌ Database connection error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 Connection lost, pool will create a new one');
        }
    });
});

pool.on('acquire', (connection) => {
    console.log('📥 Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
    console.log('📤 Connection %d released', connection.threadId);
});

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Graceful shutdown
const closePool = async () => {
    try {
        await pool.end();
        console.log('🔌 Database pool closed');
    } catch (error) {
        console.error('❌ Error closing database pool:', error.message);
    }
};

// Query wrapper with retry logic for connection issues
const executeQuery = async (query, params, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            if (error.code === 'PROTOCOL_CONNECTION_LOST' && i < retries - 1) {
                console.log(`🔄 Connection lost, retrying... (${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                continue;
            }
            throw error;
        }
    }
};

module.exports = { pool, testConnection, closePool, executeQuery };
