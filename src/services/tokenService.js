/**
 * Token Service
 * 
 * Handles storage, retrieval, and refresh of RingCentral OAuth tokens.
 * Automatically refreshes tokens when they expire or are about to expire.
 */

const { pool } = require('../config/database');
const { getSDK, getPlatform } = require('../config/ringcentral');

/**
 * Store or update RingCentral tokens for a user
 * @param {number} userId - User ID
 * @param {Object} tokenData - Token data from RingCentral
 * @returns {Promise<Object>} Stored token record
 */
async function storeTokens(userId, tokenData) {
    const {
        access_token,
        refresh_token,
        expires_in,
        token_type = 'Bearer',
        scope,
        account_id,
        extension_id
    } = tokenData;

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    try {
        // Check if tokens exist for this user
        const [existing] = await pool.execute(
            'SELECT id FROM ringcentral_tokens WHERE user_id = ?',
            [userId]
        );

        if (existing.length > 0) {
            // Update existing tokens
            await pool.execute(
                `UPDATE ringcentral_tokens 
                 SET access_token = ?, refresh_token = ?, expires_at = ?, 
                     token_type = ?, scope = ?, account_id = ?, extension_id = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [access_token, refresh_token, expiresAt, token_type, scope, account_id, extension_id, userId]
            );
        } else {
            // Insert new tokens
            await pool.execute(
                `INSERT INTO ringcentral_tokens 
                 (user_id, access_token, refresh_token, expires_at, token_type, scope, account_id, extension_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, access_token, refresh_token, expiresAt, token_type, scope, account_id, extension_id]
            );
        }

        // Return stored token record
        const [tokens] = await pool.execute(
            'SELECT * FROM ringcentral_tokens WHERE user_id = ?',
            [userId]
        );

        return tokens[0];
    } catch (error) {
        console.error('Error storing tokens:', error);
        throw new Error(`Failed to store tokens: ${error.message}`);
    }
}

/**
 * Get tokens for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Token record or null if not found
 */
async function getTokens(userId) {
    try {
        const [tokens] = await pool.execute(
            'SELECT * FROM ringcentral_tokens WHERE user_id = ?',
            [userId]
        );

        return tokens.length > 0 ? tokens[0] : null;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw new Error(`Failed to get tokens: ${error.message}`);
    }
}

/**
 * Check if token is expired or expiring soon
 * @param {Object} tokenRecord - Token record from database
 * @param {number} bufferMinutes - Minutes before expiry to consider token expired (default: 5)
 * @returns {boolean} True if token is expired or expiring soon
 */
function isTokenExpired(tokenRecord, bufferMinutes = 5) {
    if (!tokenRecord || !tokenRecord.expires_at) {
        return true;
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    const bufferMs = bufferMinutes * 60 * 1000;
    const now = new Date();

    return now.getTime() >= (expiresAt.getTime() - bufferMs);
}

/**
 * Refresh access token using refresh token
 * @param {number} userId - User ID
 * @returns {Promise<Object>} New token data
 */
async function refreshAccessToken(userId) {
    try {
        const tokenRecord = await getTokens(userId);
        
        if (!tokenRecord) {
            throw new Error('No tokens found for user');
        }

        if (!tokenRecord.refresh_token) {
            throw new Error('No refresh token available');
        }

        // Get platform instance and refresh token
        const platform = getSDK().platform();
        platform.auth().setData({
            refresh_token: tokenRecord.refresh_token
        });

        const response = await platform.refresh();
        const tokenData = response.json();

        // Update stored tokens
        const updatedTokenData = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || tokenRecord.refresh_token, // Keep old if not provided
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'Bearer',
            scope: tokenData.scope || tokenRecord.scope,
            account_id: tokenData.owner_id || tokenRecord.account_id,
            extension_id: tokenData.endpoint_id || tokenRecord.extension_id
        };

        await storeTokens(userId, updatedTokenData);

        return updatedTokenData;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error(`Failed to refresh token: ${error.message}`);
    }
}

/**
 * Get valid access token (refresh if needed)
 * @param {number} userId - User ID
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(userId) {
    const tokenRecord = await getTokens(userId);
    
    if (!tokenRecord) {
        throw new Error('RingCentral not connected. Please connect your account.');
    }

    // Check if token needs refresh
    if (isTokenExpired(tokenRecord)) {
        console.log(`Token expired for user ${userId}, refreshing...`);
        const newTokens = await refreshAccessToken(userId);
        return newTokens.access_token;
    }

    return tokenRecord.access_token;
}

/**
 * Delete tokens for a user (disconnect RingCentral)
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteTokens(userId) {
    try {
        const [result] = await pool.execute(
            'DELETE FROM ringcentral_tokens WHERE user_id = ?',
            [userId]
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error deleting tokens:', error);
        throw new Error(`Failed to delete tokens: ${error.message}`);
    }
}

/**
 * Check if user has RingCentral connected
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if connected
 */
async function isConnected(userId) {
    const tokens = await getTokens(userId);
    return tokens !== null && !isTokenExpired(tokens);
}

module.exports = {
    storeTokens,
    getTokens,
    isTokenExpired,
    refreshAccessToken,
    getValidAccessToken,
    deleteTokens,
    isConnected
};

