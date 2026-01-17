const User = require('../models/User');
const { comparePassword } = require('../utils/passwordUtils');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');
const { successResponse, errorResponse } = require('../utils/responseUtils');

/**
 * Register new user
 * POST /auth/register
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return errorResponse(res, 409, 'User with this email already exists');
        }

        // Create new user
        const user = await User.create({ name, email, password, role });

        // Generate tokens
        const tokenPayload = { id: user.id, email: user.email, role: user.role };
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // Store refresh token in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await User.storeRefreshToken(user.id, refreshToken, expiresAt);

        return successResponse(res, 201, 'User registered successfully', {
            user,
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse(res, 500, 'Server error during registration');
    }
};

/**
 * Login user
 * POST /auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return errorResponse(res, 401, 'Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return errorResponse(res, 401, 'Invalid email or password');
        }

        // Generate tokens
        const tokenPayload = { id: user.id, email: user.email, role: user.role };
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // Store refresh token in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await User.storeRefreshToken(user.id, refreshToken, expiresAt);

        // Remove password from user object
        delete user.password;

        return successResponse(res, 200, 'Login successful', {
            user,
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 500, 'Server error during login');
    }
};

/**
 * Get authenticated user profile
 * GET /auth/me
 */
const getMe = async (req, res) => {
    try {
        // User data is attached by authMiddleware
        const user = await User.findById(req.user.id);

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        return successResponse(res, 200, 'User profile retrieved successfully', { user });
    } catch (error) {
        console.error('Get profile error:', error);
        return errorResponse(res, 500, 'Server error while fetching profile');
    }
};

/**
 * Logout user
 * POST /auth/logout
 */
const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(res, 400, 'Refresh token is required');
        }

        // Delete refresh token from database
        await User.deleteRefreshToken(refreshToken);

        return successResponse(res, 200, 'Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
        return errorResponse(res, 500, 'Server error during logout');
    }
};

/**
 * Refresh access token
 * POST /auth/refresh-token
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(res, 400, 'Refresh token is required');
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch (error) {
            return errorResponse(res, 401, 'Invalid or expired refresh token');
        }

        // Check if refresh token exists in database
        const storedToken = await User.findRefreshToken(refreshToken);
        if (!storedToken) {
            return errorResponse(res, 401, 'Refresh token not found or expired');
        }

        // Generate new access token
        const tokenPayload = { id: decoded.id, email: decoded.email, role: decoded.role };
        const newAccessToken = generateAccessToken(tokenPayload);

        return successResponse(res, 200, 'Access token refreshed successfully', {
            accessToken: newAccessToken
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        return errorResponse(res, 500, 'Server error during token refresh');
    }
};

module.exports = {
    register,
    login,
    getMe,
    logout,
    refreshToken
};
