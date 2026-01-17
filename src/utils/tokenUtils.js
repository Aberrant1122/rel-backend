const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

/**
 * Generate access token
 * @param {object} payload - Token payload (user data)
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, jwtConfig.accessToken.secret, {
        expiresIn: jwtConfig.accessToken.expiresIn
    });
};

/**
 * Generate refresh token
 * @param {object} payload - Token payload (user data)
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, jwtConfig.refreshToken.secret, {
        expiresIn: jwtConfig.refreshToken.expiresIn
    });
};

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {object} Decoded token payload
 */
const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, jwtConfig.accessToken.secret);
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, jwtConfig.refreshToken.secret);
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};
