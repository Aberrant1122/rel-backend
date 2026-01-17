const { errorResponse } = require('../utils/responseUtils');

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
        // Check if user is authenticated (authMiddleware should run first)
        if (!req.user) {
            return errorResponse(res, 401, 'Authentication required');
        }

        // Check if user's role is allowed
        if (!allowedRoles.includes(req.user.role)) {
            return errorResponse(res, 403, 'Access forbidden: Insufficient permissions');
        }

        next();
    };
};

module.exports = roleMiddleware;
