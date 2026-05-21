const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { pool } = require('../config/database');

/**
 * Get all users
 * GET /users
 */
const getAllUsers = async (req, res) => {
    try {
        const query = 'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at DESC';
        const [users] = await pool.query(query);

        return successResponse(res, 200, 'Users retrieved successfully', {
            users,
            total: users.length
        });
    } catch (error) {
        console.error('Get all users error:', error);
        return errorResponse(res, 500, 'Server error while fetching users');
    }
};

/**
 * Create new user
 * POST /users
 */
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return errorResponse(res, 400, 'Name, email, and password are required');
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return errorResponse(res, 409, 'User with this email already exists');
        }

        // Create new user
        const user = await User.create({ name, email, password, role: role || 'employee' });

        return successResponse(res, 201, 'User created successfully', { user });
    } catch (error) {
        console.error('Create user error:', error);
        return errorResponse(res, 500, 'Server error while creating user');
    }
};

/**
 * Update user profile
 * PUT /users/profile
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!name || !email) {
            return errorResponse(res, 400, 'Name and email are required');
        }

        // Get current user with password
        const currentUser = await User.findByIdWithPassword(userId);
        if (!currentUser) {
            return errorResponse(res, 404, 'User not found');
        }

        // If changing password, validate current password
        if (newPassword) {
            if (!currentPassword) {
                return errorResponse(res, 400, 'Current password is required to change password');
            }

            const isValidPassword = await User.validatePassword(currentPassword, currentUser.password);
            if (!isValidPassword) {
                return errorResponse(res, 400, 'Current password is incorrect');
            }
        }

        // Check if email is already taken by another user
        if (email !== currentUser.email) {
            const existingUser = await User.findByEmail(email);
            if (existingUser && existingUser.id !== userId) {
                return errorResponse(res, 409, 'Email is already taken by another user');
            }
        }

        // Update user
        const updateData = { name, email };
        if (newPassword) {
            updateData.password = await User.hashPassword(newPassword);
        }

        await User.update(userId, updateData);

        // Get updated user (without password)
        const updatedUser = await User.findById(userId);
        delete updatedUser.password;

        return successResponse(res, 200, 'Profile updated successfully', { user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        return errorResponse(res, 500, 'Server error while updating profile');
    }
};

/**
 * Update user by ID
 * PUT /users/:id
 */
const updateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Check if email is taken by someone else
        if (email && email !== user.email) {
            const existingUser = await User.findByEmail(email);
            if (existingUser && existingUser.id !== parseInt(id)) {
                return errorResponse(res, 409, 'Email is already taken');
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (role !== undefined) updateData.role = role;
        if (password) {
            updateData.password = await User.hashPassword(password);
        }

        if (Object.keys(updateData).length > 0) {
            await User.update(id, updateData);
        }

        const updatedUser = await User.findById(id);
        delete updatedUser.password;

        return successResponse(res, 200, 'User updated successfully', { user: updatedUser });
    } catch (error) {
        console.error('Update user by ID error:', error);
        return errorResponse(res, 500, 'Server error while updating user');
    }
};

/**
 * Delete user
 * DELETE /users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Handle dependencies in reservations table
        // 1. Nullify created_by references
        await pool.query('UPDATE reservations SET created_by = NULL WHERE created_by = ?', [id]);
        
        // 2. Delete reservations where the user is the passenger (since passenger_id is NOT NULL)
        await pool.query('DELETE FROM reservations WHERE passenger_id = ?', [id]);

        // Delete user
        const query = 'DELETE FROM users WHERE id = ?';
        await pool.query(query, [id]);

        return successResponse(res, 200, 'User deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        return errorResponse(res, 500, 'Server error while deleting user');
    }
};

/**
 * Get all passengers (users with role 'user' or 'passenger')
 * GET /users/passengers
 */
const getPassengers = async (req, res) => {
    try {
        const query = `
            SELECT id, name, email, phone, role, created_at 
            FROM users 
            WHERE role IN ('user', 'passenger') OR role IS NULL OR role = ''
            ORDER BY created_at DESC
        `;
        const [passengers] = await pool.query(query);

        // Enhance with trip counts and basic stats
        const [tripStats] = await pool.query(`
            SELECT passenger_id, COUNT(*) as total_trips, SUM(price) as total_spent, MAX(pickup_date) as last_trip
            FROM reservations 
            GROUP BY passenger_id
        `);

        // Get saved cards count per user
        const [cardCounts] = await pool.query(`
            SELECT user_id, COUNT(*) as card_count
            FROM customer_payment_methods 
            GROUP BY user_id
        `);

        // Map stats to passengers
        const enhancedPassengers = passengers.map(p => {
            const stats = tripStats.find(s => s.passenger_id === p.id);
            const cards = cardCounts.find(c => c.user_id === p.id);
            return {
                ...p,
                totalTrips: stats ? stats.total_trips : 0,
                totalSpent: stats ? parseFloat(stats.total_spent || 0) : 0,
                lastTripDate: stats ? stats.last_trip : null,
                status: 'active', // Default status
                savedCards: cards ? cards.card_count : 0
            };
        });

        return successResponse(res, 200, 'Passengers retrieved successfully', enhancedPassengers);
    } catch (error) {
        console.error('Get passengers error:', error);
        return errorResponse(res, 500, 'Server error while fetching passengers');
    }
};

/**
 * Search passengers
 * GET /users/passengers/search
 */
const searchPassengers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return successResponse(res, 200, 'Search query empty', []);

        const searchTerm = `%${q}%`;
        const query = `
            SELECT id, name, email, phone, role 
            FROM users 
            WHERE (role IN ('user', 'passenger') OR role IS NULL OR role = '')
            AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
            LIMIT 20
        `;
        const [passengers] = await pool.query(query, [searchTerm, searchTerm, searchTerm]);

        return successResponse(res, 200, 'Passengers found', passengers);
    } catch (error) {
        console.error('Search passengers error:', error);
        return errorResponse(res, 500, 'Server error while searching passengers');
    }
};

/**
 * Get single passenger by ID with full details
 * GET /api/users/passengers/:id
 */
const getPassengerById = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.query(`
            SELECT id, name, email, phone, role, stripe_customer_id, created_at 
            FROM users 
            WHERE id = ? AND (role IN ('user', 'passenger') OR role IS NULL OR role = '')
        `, [id]);

        if (users.length === 0) {
            return errorResponse(res, 404, 'Passenger not found');
        }

        const user = users[0];

        // Trip stats
        const [tripStats] = await pool.query(`
            SELECT COUNT(*) as total_trips, SUM(price) as total_spent, MAX(pickup_date) as last_trip
            FROM reservations 
            WHERE passenger_id = ?
        `, [id]);

        // Saved payment methods count
        const [pmCount] = await pool.query(`
            SELECT COUNT(*) as count FROM customer_payment_methods WHERE user_id = ?
        `, [id]);

        // Recent reservations
        const [recentReservations] = await pool.query(`
            SELECT id, reservation_number, pickup_date, pickup_time, pickup_location, dropoff_location, 
                   price, payment_status, reservation_status, booking_type
            FROM reservations 
            WHERE passenger_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [id]);

        return successResponse(res, 200, 'Passenger retrieved successfully', {
            ...user,
            totalTrips: tripStats[0].total_trips || 0,
            totalSpent: parseFloat(tripStats[0].total_spent || 0),
            lastTripDate: tripStats[0].last_trip || null,
            savedPaymentMethodsCount: pmCount[0].count || 0,
            recentTrips: recentReservations
        });
    } catch (error) {
        console.error('Get passenger by ID error:', error);
        return errorResponse(res, 500, 'Server error while fetching passenger');
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateProfile,
    deleteUser,
    getPassengers,
    searchPassengers,
    updateUserById,
    getPassengerById
};
