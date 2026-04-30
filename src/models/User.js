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
                phone VARCHAR(20) NULL,
                role ENUM('admin', 'driver', 'dispatcher') DEFAULT 'dispatcher',
                is_active BOOLEAN DEFAULT true,
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
     * Add missing columns to existing table
     */
    static async addMissingColumns() {
        try {
            // Check and add phone column
            const [phoneExists] = await pool.execute(`
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME = 'phone'
            `);
            
            if (phoneExists[0].count === 0) {
                console.log('📝 Adding phone column...');
                await pool.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
                console.log('✅ Phone column added');
            }

            // Check and add is_active column
            const [activeExists] = await pool.execute(`
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME = 'is_active'
            `);
            
            if (activeExists[0].count === 0) {
                console.log('📝 Adding is_active column...');
                await pool.execute('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true');
                console.log('✅ is_active column added');
            }

        } catch (error) {
            console.warn('⚠️  Could not add missing columns:', error.message);
        }
    }

    /**
     * Update existing table to support all roles (migration)
     */
    static async updateRoles() {
        try {
            // Check current column type
            const [columns] = await pool.execute(`
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'role'
            `);
            
            if (columns.length > 0) {
                const columnType = columns[0].COLUMN_TYPE;
                // Check if column matches the expected 3-role enum
                const expected = "enum('admin','driver','dispatcher')";
                if (columnType.toLowerCase() !== expected) {
                    console.log('🔧 Updating role column to admin/driver/dispatcher...');
                    await pool.execute(`
                        ALTER TABLE users 
                        MODIFY COLUMN role ENUM('admin', 'driver', 'dispatcher') 
                        DEFAULT 'dispatcher'
                    `);
                    console.log('✅ Role column updated successfully');
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not verify/update role column:', error.message);
        }
    }

    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.query(query, [email]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find user by ID - Updated to handle missing columns
     */
    static async findById(id) {
        try {
            // Try to select with all columns
            const query = 'SELECT id, name, email, phone, role, is_active, created_at, updated_at FROM users WHERE id = ?';
            const [rows] = await pool.query(query, [id]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            // If columns are missing, fallback to basic columns
            if (error.code === 'ER_BAD_FIELD_ERROR') {
                console.log('⚠️  Missing columns detected, using fallback query');
                const query = 'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?';
                const [rows] = await pool.query(query, [id]);
                return rows.length > 0 ? rows[0] : null;
            }
            throw error;
        }
    }

    /**
     * Find user by ID with password (for authentication)
     */
    static async findByIdWithPassword(id) {
        const query = 'SELECT * FROM users WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find users by role
     */
    static async findByRole(role) {
        try {
            const query = 'SELECT id, name, email, phone, role FROM users WHERE role = ? AND is_active = true';
            const [rows] = await pool.query(query, [role]);
            return rows;
        } catch (error) {
            // Fallback without is_active
            const query = 'SELECT id, name, email, phone, role FROM users WHERE role = ?';
            const [rows] = await pool.query(query, [role]);
            return rows;
        }
    }

    /**
     * Search passengers by name, email, or phone
     */
    static async searchPassengers(searchTerm) {
        try {
            const query = `
                SELECT id, name, email, phone, role 
                FROM users 
                WHERE role = 'passenger' 
                AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
                LIMIT 10
            `;
            const term = `%${searchTerm}%`;
            const [rows] = await pool.query(query, [term, term, term]);
            return rows;
        } catch (error) {
            // Fallback without phone
            const query = `
                SELECT id, name, email, role 
                FROM users 
                WHERE role = 'passenger' 
                AND (name LIKE ? OR email LIKE ?)
                LIMIT 10
            `;
            const term = `%${searchTerm}%`;
            const [rows] = await pool.query(query, [term, term]);
            return rows;
        }
    }

    /**
     * Update user
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = ['name', 'email', 'phone', 'role', 'is_active'];
        
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(query, values);

        return result.affectedRows > 0;
    }

    /**
     * Update user role
     */
    static async updateRole(userId, newRole) {
        const validRoles = ['admin', 'driver', 'dispatcher'];
        
        if (!validRoles.includes(newRole)) {
            throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
        }
        
        const query = 'UPDATE users SET role = ? WHERE id = ?';
        const [result] = await pool.query(query, [newRole, userId]);
        
        return result.affectedRows > 0;
    }

    /**
     * Hash password
     */
    static async hashPassword(password) {
        return await hashPassword(password);
    }

    /**
     * Validate password
     */
    static async validatePassword(plainPassword, hashedPassword) {
        return await comparePassword(plainPassword, hashedPassword);
    }

    /**
     * Create new user
     */
    static async create(userData) {
        const { name, email, password, phone = null, role = 'employee' } = userData;

        // Hash password
        const hashedPassword = await hashPassword(password);

        const query = 'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.query(query, [name, email, hashedPassword, phone, role]);

        // Return created user without password
        return await this.findById(result.insertId);
    }

    /**
     * Create a passenger user
     */
    static async createPassenger(passengerData) {
        const { name, email, phone, password } = passengerData;
        
        // Check if user already exists
        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            return existingUser;
        }
        
        // Generate random password if not provided
        const userPassword = password || Math.random().toString(36).slice(-8);
        
        return await this.create({
            name,
            email,
            password: userPassword,
            phone,
            role: 'passenger'
        });
    }

    /**
     * Store refresh token
     */
    static async storeRefreshToken(userId, token, expiresAt) {
        const query = 'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
        await pool.query(query, [userId, token, expiresAt]);
    }

    /**
     * Find refresh token
     */
    static async findRefreshToken(token) {
        const query = 'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()';
        const [rows] = await pool.query(query, [token]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Delete refresh token
     */
    static async deleteRefreshToken(token) {
        const query = 'DELETE FROM refresh_tokens WHERE token = ?';
        await pool.query(query, [token]);
    }

    /**
     * Delete all user's refresh tokens
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

    /**
     * Initialize database with all tables and roles
     */
    static async initialize() {
        await this.createTable();
        await this.addMissingColumns(); // Add this line
        await this.updateRoles();
        await this.createRefreshTokensTable();
        
        // Create default admin user if not exists
        const adminExists = await this.findByEmail('admin@rel.com');
        if (!adminExists) {
            await this.create({
                name: 'Admin User',
                email: 'admin@rel.com',
                password: 'Admin@123',
                role: 'admin'
            });
            console.log('✅ Default admin user created');
        }
        
        console.log('✅ Database initialization complete');
    }
}

module.exports = User;