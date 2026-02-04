require('dotenv').config();
const { pool } = require('../src/config/database');

async function migrate() {
    try {
        console.log('Adding assigned_to column to tasks table...');
        await pool.query('ALTER TABLE tasks ADD COLUMN assigned_to INT NULL AFTER user_id');
        console.log('Adding foreign key to assigned_to...');
        await pool.query('ALTER TABLE tasks ADD CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL');
        console.log('Migration successful!');
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column assigned_to already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        process.exit();
    }
}

migrate();
