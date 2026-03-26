/**
 * Send success response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {object} data - Response data
 */
const successResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        message
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {object} errors - Validation errors (optional)
 */
const errorResponse = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        message
    };

    if (errors !== null) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send pagination response
 * @param {object} res - Express response object
 * @param {array} data - Data array
 * @param {number} total - Total records count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {string} message - Success message
 */
const paginationResponse = (res, data, total, page, limit, message = 'Success') => {
    const response = {
        success: true,
        message,
        data: data,
        pagination: {
            total: total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
        },
        timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);
};

module.exports = {
    successResponse,
    errorResponse,
    paginationResponse
};