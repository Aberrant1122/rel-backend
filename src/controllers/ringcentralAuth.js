/**
 * RingCentral Authentication Controller
 * 
 * Handles OAuth flow: authorization, callback, token management, and disconnect.
 */

const { getAuthorizationURL, exchangeCodeForTokens } = require('../config/ringcentral');
const tokenService = require('../services/tokenService');
const ringcentralService = require('../services/ringCentralService');

/**
 * Initiate OAuth flow - redirect to RingCentral authorization
 * GET /api/auth/ringcentral
 */
async function initiateAuth(req, res) {
    try {
        const userId = req.user.id; // Assuming auth middleware sets req.user

        // Check if already connected
        const isConnected = await tokenService.isConnected(userId);
        if (isConnected) {
            return res.json({
                success: true,
                message: 'RingCentral already connected',
                connected: true
            });
        }

        // Generate authorization URL
        const state = `${userId}_${Date.now()}`; // Include user ID in state for security
        const authUrl = getAuthorizationURL(state);

        res.json({
            success: true,
            authUrl: authUrl,
            message: 'Redirect to this URL to authorize RingCentral'
        });
    } catch (error) {
        console.error('Error initiating auth:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate authorization',
            error: error.message
        });
    }
}

/**
 * Handle OAuth callback - exchange code for tokens
 * GET /api/auth/ringcentral/callback
 */
async function handleCallback(req, res) {
    try {
        const { code, error, error_description } = req.query;

        // Handle errors from RingCentral
        if (error) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/ringcentral?error=${encodeURIComponent(error_description || error)}`);
        }

        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/ringcentral?error=No authorization code received`);
        }

        // Get user ID from session or token (adjust based on your auth system)
        const userId = req.user?.id;
        if (!userId) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=Authentication required`);
        }

        // Exchange code for tokens
        const tokenData = await exchangeCodeForTokens(code);

        // Store tokens in database
        await tokenService.storeTokens(userId, tokenData);

        // Get account info to verify connection
        try {
            const accountInfo = await ringcentralService.getAccountInfo(userId);
            console.log(`RingCentral connected for user ${userId}, account: ${accountInfo.name}`);
        } catch (infoError) {
            console.warn('Could not fetch account info after connection:', infoError);
        }

        // Redirect to frontend with success
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/ringcentral?success=true`);
    } catch (error) {
        console.error('Error handling callback:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/ringcentral?error=${encodeURIComponent(error.message)}`);
    }
}

/**
 * Get connection status
 * GET /api/ringcentral/status
 */
async function getStatus(req, res) {
    try {
        const userId = req.user.id;

        const isConnected = await tokenService.isConnected(userId);

        if (!isConnected) {
            return res.json({
                success: true,
                connected: false,
                message: 'RingCentral not connected'
            });
        }

        // Get account info
        try {
            const accountInfo = await ringcentralService.getAccountInfo(userId);
            const extensionInfo = await ringcentralService.getExtensionInfo(userId);

            res.json({
                success: true,
                connected: true,
                account: {
                    name: accountInfo.name,
                    id: accountInfo.id
                },
                extension: {
                    name: extensionInfo.name,
                    extensionNumber: extensionInfo.extensionNumber
                }
            });
        } catch (error) {
            // Token might be invalid, but record exists
            res.json({
                success: true,
                connected: false,
                message: 'Connection expired. Please reconnect.',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get connection status',
            error: error.message
        });
    }
}

/**
 * Disconnect RingCentral account
 * DELETE /api/ringcentral/disconnect
 */
async function disconnect(req, res) {
    try {
        const userId = req.user.id;

        const deleted = await tokenService.deleteTokens(userId);

        if (deleted) {
            res.json({
                success: true,
                message: 'RingCentral account disconnected successfully'
            });
        } else {
            res.json({
                success: false,
                message: 'No RingCentral connection found'
            });
        }
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disconnect RingCentral account',
            error: error.message
        });
    }
}

module.exports = {
    initiateAuth,
    handleCallback,
    getStatus,
    disconnect
};

