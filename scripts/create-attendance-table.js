const { pool } = require('../src/config/database');

async function createAttendanceTable() {
    try {
        console.log('🔄 Creating attendance table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                date DATE NOT NULL,
                check_in DATETIME NOT NULL,
                check_out DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY user_date_unique (user_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✅ Attendance table created successfully');
    } catch (error) {
        console.error('❌ Error creating attendance table:', error);
    } finally {
        process.exit();
    }
}

createAttendanceTable();
