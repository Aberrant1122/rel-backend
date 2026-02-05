require('dotenv').config();
const { pool } = require('../src/config/database');

async function createNotificationsTable() {
    try {
        console.log('🔄 Creating notifications table...');

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                related_id INT NULL,
                related_type VARCHAR(50) NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at),
                INDEX idx_type (type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Notifications table created successfully');

        // Check if table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'notifications'");
        console.log('✅ Table verification:', tables.length > 0 ? 'EXISTS' : 'NOT FOUND');

        // Show table structure
        const [columns] = await pool.query('DESCRIBE notifications');
        console.log('\n📋 Table structure:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating notifications table:', error.message);
        process.exit(1);
    }
}

createNotificationsTable();
