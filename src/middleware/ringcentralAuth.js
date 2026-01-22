/**
 * RingCentral Authentication Middleware
 * 
 * Verifies that user has connected RingCentral account before allowing access to RingCentral features.
 */

const tokenService = require('../services/tokenService');

/**
 * Middleware to check if user has RingCentral connected
 * Returns 403 if not connected
 */
async function requireRingCentralConnection(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const isConnected = await tokenService.isConnected(userId);

        if (!isConnected) {
            return res.status(403).json({
                success: false,
                message: 'RingCentral account not connected. Please connect your account first.',
                requiresConnection: true
            });
        }

        // Attach token info to request for use in controllers
        req.ringcentralTokens = await tokenService.getTokens(userId);

        next();
    } catch (error) {
        console.error('Error in RingCentral auth middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking RingCentral connection',
            error: error.message
        });
    }
}

/**
 * Optional middleware - doesn't fail if not connected, just sets flag
 */
async function checkRingCentralConnection(req, res, next) {
    try {
        const userId = req.user?.id;

        if (userId) {
            const isConnected = await tokenService.isConnected(userId);
            req.ringcentralConnected = isConnected;
            
            if (isConnected) {
                req.ringcentralTokens = await tokenService.getTokens(userId);
            }
        } else {
            req.ringcentralConnected = false;
        }

        next();
    } catch (error) {
        // Don't fail on error, just set to false
        req.ringcentralConnected = false;
        next();
    }
}

module.exports = {
    requireRingCentralConnection,
    checkRingCentralConnection
};

