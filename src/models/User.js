const { pool } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');

class User {
    /**
     * Create users table if not exists
     */
    static async createTable() {
        const query = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        try {
            await pool.query(query);
            console.log('✅ Users table ready');
        } catch (error) {
            console.error('❌ Error creating users table:', error.message);
            throw error;
        }
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {object|null} User object or null
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.query(query, [email]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {object|null} User object or null
     */
    static async findById(id) {
        const query = 'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find user by ID with password (for authentication)
     * @param {number} id - User ID
     * @returns {object|null} User object with password or null
     */
    static async findByIdWithPassword(id) {
        const query = 'SELECT * FROM users WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Update user
     * @param {number} id - User ID
     * @param {object} updateData - Data to update
     * @returns {boolean} Success status
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            fields.push(`${key} = ?`);
            values.push(updateData[key]);
        });

        values.push(id);

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(query, values);
        
        return result.affectedRows > 0;
    }

    /**
     * Hash password
     * @param {string} password - Plain password
     * @returns {string} Hashed password
     */
    static async hashPassword(password) {
        return await hashPassword(password);
    }

    /**
     * Validate password
     * @param {string} plainPassword - Plain password
     * @param {string} hashedPassword - Hashed password
     * @returns {boolean} Is valid
     */
    static async validatePassword(plainPassword, hashedPassword) {
        return await comparePassword(plainPassword, hashedPassword);
    }

    /**
     * Create new user
     * @param {object} userData - User data {name, email, password, role}
     * @returns {object} Created user
     */
    static async create(userData) {
        const { name, email, password, role = 'user' } = userData;

        // Hash password
        const hashedPassword = await hashPassword(password);

        const query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(query, [name, email, hashedPassword, role]);

        // Return created user without password
        return await this.findById(result.insertId);
    }

    /**
     * Store refresh token
     * @param {number} userId - User ID
     * @param {string} token - Refresh token
     * @param {Date} expiresAt - Expiration date
     */
    static async storeRefreshToken(userId, token, expiresAt) {
        const query = 'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
        await pool.query(query, [userId, token, expiresAt]);
    }

    /**
     * Find refresh token
     * @param {string} token - Refresh token
     * @returns {object|null} Token object or null
     */
    static async findRefreshToken(token) {
        const query = 'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()';
        const [rows] = await pool.query(query, [token]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Delete refresh token
     * @param {string} token - Refresh token
     */
    static async deleteRefreshToken(token) {
        const query = 'DELETE FROM refresh_tokens WHERE token = ?';
        await pool.query(query, [token]);
    }

    /**
     * Delete all user's refresh tokens
     * @param {number} userId - User ID
     */
    static async deleteAllUserTokens(userId) {
        const query = 'DELETE FROM refresh_tokens WHERE user_id = ?';
        await pool.query(query, [userId]);
    }

    /**
     * Create refresh tokens table
     */
    static async createRefreshTokensTable() {
        const query = `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token(255)),
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        try {
            await pool.query(query);
            console.log('✅ Refresh tokens table ready');
        } catch (error) {
            console.error('❌ Error creating refresh tokens table:', error.message);
            throw error;
        }
    }
}

module.exports = User;
