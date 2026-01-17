/**
 * @fileoverview Google OAuth Controller
 * Handles OAuth2 authentication routes and callbacks
 */

const googleOAuthService = require('../services/googleOAuthService');
const { successResponse, errorResponse } = require('../utils/responseUtils');

// Frontend URL for redirects
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google
 */
const initiateOAuth = async (req, res) => {
    try {
        console.log('[GoogleOAuthController] Initiating OAuth flow');

        // Ensure user is authenticated (required by authMiddleware)
        if (!req.user || !req.user.id) {
            console.error('[GoogleOAuthController] No authenticated user found');
            return errorResponse(
                res,
                401,
                'Authentication required to connect Google account'
            );
        }

        const userId = req.user.id;
        console.log('[GoogleOAuthController] Authenticated user:', { userId });

        // Create state with user info for secure user binding
        const state = JSON.stringify({ userId });

        const authUrl = googleOAuthService.getAuthorizationUrl(state);

        console.log('[GoogleOAuthController] Redirecting to Google OAuth', { userId });

        // Redirect user to Google's OAuth consent screen
        res.redirect(authUrl);
    } catch (error) {
        console.error('[GoogleOAuthController] Failed to initiate OAuth:', error.message);

        return errorResponse(
            res,
            500,
            'Failed to initiate Google OAuth',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

/**
 * Handle OAuth callback from Google
 * GET /api/auth/google/callback
 */
const handleCallback = async (req, res) => {
    try {
        console.log('[GoogleOAuthController] Received OAuth callback');

        const { code, error: oauthError, state } = req.query;

        // Handle OAuth errors from Google
        if (oauthError) {
            console.error('[GoogleOAuthController] OAuth error from Google:', oauthError);
            return res.redirect(`${FRONTEND_URL}/calendar?google=error&message=${encodeURIComponent(oauthError)}`);
        }

        if (!code) {
            console.error('[GoogleOAuthController] No authorization code received');
            return res.redirect(`${FRONTEND_URL}/calendar?google=error&message=${encodeURIComponent('No authorization code received')}`);
        }

        // Validate and parse state parameter (required for security)
        if (!state) {
            console.error('[GoogleOAuthController] Missing state parameter');
            return res.redirect(`${FRONTEND_URL}/calendar?google=error&message=${encodeURIComponent('Invalid OAuth state - please try again')}`);
        }

        let userId = null;
        try {
            const decoded = JSON.parse(state);
            userId = decoded.userId;

            if (!userId || typeof userId !== 'number') {
                throw new Error('Invalid userId in state');
            }
        } catch (e) {
            console.error('[GoogleOAuthController] Failed to parse state:', e.message);
            return res.redirect(`${FRONTEND_URL}/calendar?google=error&message=${encodeURIComponent('Invalid OAuth state - please try again')}`);
        }

        console.log('[GoogleOAuthController] Exchanging code for tokens', { userId });

        // Exchange code for tokens
        const tokens = await googleOAuthService.exchangeCodeForTokens(code);

        // Get user info from Google
        const userInfo = await googleOAuthService.getUserInfo(tokens.access_token);

        console.log('[GoogleOAuthController] OAuth successful', {
            userId,
            email: userInfo.email,
            hasRefreshToken: !!tokens.refresh_token
        });

        // Save tokens to database with the authenticated user ID
        await googleOAuthService.saveTokens(userId, userInfo.email, tokens);

        console.log('[GoogleOAuthController] Google OAuth linked to user', { userId });
        console.log(`Google OAuth linked to user ${userId}`);
        console.log('[GoogleOAuthController] Tokens saved, redirecting to frontend');

        // Redirect to frontend success page
        res.redirect(`${FRONTEND_URL}/calendar?google=connected&email=${encodeURIComponent(userInfo.email)}`);
    } catch (error) {
        console.error('[GoogleOAuthController] OAuth callback failed:', error.message);

        const errorMessage = encodeURIComponent(error.message || 'Authentication failed');
        res.redirect(`${FRONTEND_URL}/calendar?google=error&message=${errorMessage}`);
    }
};

/**
 * Get Google OAuth connection status
 * GET /api/auth/google/status
 */
const getStatus = async (req, res) => {
    try {
        console.log('[GoogleOAuthController] Checking connection status');

        const userId = req.user?.id || null;
        const status = await googleOAuthService.getConnectionStatus(userId);

        return successResponse(res, 200, 'Google OAuth status retrieved', status);
    } catch (error) {
        console.error('[GoogleOAuthController] Failed to get status:', error.message);

        return errorResponse(
            res,
            500,
            'Failed to get Google OAuth status',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

/**
 * Disconnect Google OAuth
 * POST /api/auth/google/disconnect
 */
const disconnect = async (req, res) => {
    try {
        console.log('[GoogleOAuthController] Disconnecting Google account');

        const userId = req.user?.id || null;
        const deleted = await googleOAuthService.deleteTokens(userId);

        if (deleted) {
            return successResponse(res, 200, 'Google account disconnected successfully');
        } else {
            return errorResponse(res, 404, 'No Google account connected');
        }
    } catch (error) {
        console.error('[GoogleOAuthController] Failed to disconnect:', error.message);

        return errorResponse(
            res,
            500,
            'Failed to disconnect Google account',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

module.exports = {
    initiateOAuth,
    handleCallback,
    getStatus,
    disconnect
};






