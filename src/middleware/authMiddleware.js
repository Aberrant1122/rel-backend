const { verifyAccessToken } = require('../utils/tokenUtils');
const { errorResponse } = require('../utils/responseUtils');

/**
 * Authentication middleware - Verify JWT access token
 * Supports token from Authorization header or query parameter (dev-only)
 */
const authMiddleware = (req, res, next) => {
    try {
        // Get token from query parameter (dev-only) or Authorization header
        const token = req.query.token || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return errorResponse(res, 401, 'Access token is required');
        }

        // Log warning for query token usage (dev-only feature)
        if (req.query.token) {
            console.warn('[AuthMiddleware] Using token from query parameter (dev-only feature)');
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        // Attach user data to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        return errorResponse(res, 401, error.message || 'Invalid or expired token');
    }
};

module.exports = authMiddleware;
