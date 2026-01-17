const ringCentralService = require('../services/ringCentralService');
const { successResponse, errorResponse } = require('../utils/responseUtils');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const initiateOAuth = (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return errorResponse(res, 401, 'Authentication required');
        }
        const url = ringCentralService.getAuthorizationUrl();
        // We can pass state if the SDK supports it, or store session. 
        // For simplicity, we assume one intiation flow. 
        // Ideally we should pass userId in state like Google OAuth but RC SDK loginUrl() 
        // might accept options.
        // Let's rely on session cookie or just redirect. 
        // Wait, we need to bind the callback to the user.
        // The RC SDK loginUrl({ state: ... }) supports it.
        const rcsdk = require('@ringcentral/sdk').SDK;
        const sdk = new rcsdk({
            clientId: process.env.RINGCENTRAL_CLIENT_ID,
            clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
            server: process.env.RINGCENTRAL_SERVER_URL
        });
        const platform = sdk.platform();
        const state = JSON.stringify({ userId: req.user.id });
        const loginUrl = platform.loginUrl({
            redirectUri: process.env.RINGCENTRAL_REDIRECT_URI || 'http://localhost:5000/api/auth/ringcentral/callback',
            state: state
        });

        res.redirect(loginUrl);
    } catch (error) {
        errorResponse(res, 500, error.message);
    }
};

const handleCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
        return res.redirect(`${FRONTEND_URL}/settings?rc=error&message=${encodeURIComponent(error_description || error)}`);
    }

    try {
        let userId = null;
        if (state) {
            const decoded = JSON.parse(state);
            userId = decoded.userId;
        }

        if (!userId) {
            // If no state, we can't link to a user. This is a security issue.
            return res.redirect(`${FRONTEND_URL}/settings?rc=error&message=Invalid+State`);
        }

        const tokens = await ringCentralService.exchangeCodeForTokens(code);
        await ringCentralService.saveTokens(userId, tokens);

        res.redirect(`${FRONTEND_URL}/settings?rc=connected`);
    } catch (err) {
        console.error('RC Callback Error', err);
        res.redirect(`${FRONTEND_URL}/settings?rc=error&message=${encodeURIComponent(err.message)}`);
    }
};

const getStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await ringCentralService.getConnectionStatus(userId);
        successResponse(res, 200, 'Status retrieved', status);
    } catch (error) {
        errorResponse(res, 500, error.message);
    }
};

const disconnect = async (req, res) => {
    try {
        const userId = req.user.id;
        await ringCentralService.disconnect(userId);
        successResponse(res, 200, 'Disconnected successfully');
    } catch (error) {
        errorResponse(res, 500, error.message);
    }
};

module.exports = {
    initiateOAuth,
    handleCallback,
    getStatus,
    disconnect
};
