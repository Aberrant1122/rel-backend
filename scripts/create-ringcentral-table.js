require('dotenv').config();
const { pool } = require('../src/config/database');

const createRingCentralTable = async () => {
    try {
        console.log('Creating ring_central_tokens table...');

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS ring_central_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                rc_user_id VARCHAR(255) NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                token_type VARCHAR(50) DEFAULT 'Bearer',
                scope TEXT NULL,
                expiry_date BIGINT NULL,
                refresh_token_expiry_date BIGINT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_rc_tokens_user_id 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ ring_central_tokens table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create table:', error);
        process.exit(1);
    }
};

createRingCentralTable();
