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
        const user = await User.create({ name, email, password, role: role || 'user' });

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

        // Delete user
        const query = 'DELETE FROM users WHERE id = ?';
        await pool.query(query, [id]);

        return successResponse(res, 200, 'User deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        return errorResponse(res, 500, 'Server error while deleting user');
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateProfile,
    deleteUser
};
