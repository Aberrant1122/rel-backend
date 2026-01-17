/**
 * @fileoverview Google OAuth Routes
 * Routes for Google OAuth2 authentication flow
 */

const express = require('express');
const router = express.Router();
const googleOAuthController = require('../controllers/googleOAuthController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/auth/google
 * @description Initiate Google OAuth flow - redirects to Google consent screen
 * @access Private (requires authentication)
 */
router.get('/google', authMiddleware, googleOAuthController.initiateOAuth);

/**
 * @route GET /api/auth/google/callback
 * @description Handle OAuth callback from Google
 * @access Public (called by Google)
 */
router.get('/google/callback', googleOAuthController.handleCallback);

/**
 * @route GET /api/auth/google/status
 * @description Get Google OAuth connection status
 * @access Private (requires authentication)
 */
router.get('/google/status', authMiddleware, googleOAuthController.getStatus);

/**
 * @route POST /api/auth/google/disconnect
 * @description Disconnect Google OAuth (revoke tokens)
 * @access Private (requires authentication)
 */
router.post('/google/disconnect', authMiddleware, googleOAuthController.disconnect);

module.exports = router;






