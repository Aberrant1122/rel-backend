const { pool } = require('../config/database');

class Task {
    /**
     * Create tasks table if it doesn't exist
     */
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                due_date DATE,
                priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
                status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
                lead_id INT,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_lead_id (lead_id),
                INDEX idx_status (status),
                INDEX idx_due_date (due_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        try {
            await pool.query(query);
            console.log('✅ Tasks table ready');
            return true;
        } catch (error) {
            console.error('❌ Error creating tasks table:', error.message);
            throw error;
        }
    }
}

module.exports = Task;
