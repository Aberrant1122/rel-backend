/**
 * @fileoverview RingCentral Service
 * Handles RingCentral API integration
 */

const RC = require('@ringcentral/sdk').SDK;
const { pool } = require('../config/database');

const RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID;
const RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET;
const RC_SERVER_URL = process.env.RINGCENTRAL_SERVER_URL; // https://platform.devtest.ringcentral.com or https://platform.ringcentral.com
const RC_REDIRECT_URI = process.env.RINGCENTRAL_REDIRECT_URI || 'http://localhost:5000/api/auth/ringcentral/callback';

const createSdk = () => {
    return new RC({
        server: RC_SERVER_URL,
        clientId: RC_CLIENT_ID,
        clientSecret: RC_CLIENT_SECRET,
        redirectUri: RC_REDIRECT_URI
    });
};

const getAuthorizationUrl = () => {
    const rcsdk = createSdk();
    const platform = rcsdk.platform();
    return platform.loginUrl();
};

const exchangeCodeForTokens = async (code) => {
    console.log('[RingCentralService] Exchanging code for tokens');
    const rcsdk = createSdk();
    const platform = rcsdk.platform();

    try {
        const data = await platform.login({
            code: code,
            redirectUri: RC_REDIRECT_URI
        });

        const json = await data.json();
        return json;
    } catch (error) {
        console.error('[RingCentralService] Token exchange failed', error);
        throw error;
    }
};

const saveTokens = async (userId, tokens) => {
    console.log('[RingCentralService] Saving tokens for user', userId);

    // Calculate expiry timestamps 
    const now = Date.now();
    const expiresIn = tokens.expires_in * 1000;
    const refreshExpiresIn = tokens.refresh_token_expires_in * 1000;

    const expiryDate = now + expiresIn;
    const refreshExpiryDate = now + refreshExpiresIn;

    const query = `
        INSERT INTO ring_central_tokens 
        (user_id, rc_user_id, access_token, refresh_token, token_type, scope, expiry_date, refresh_token_expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            rc_user_id = VALUES(rc_user_id),
            access_token = VALUES(access_token),
            refresh_token = VALUES(refresh_token),
            token_type = VALUES(token_type),
            scope = VALUES(scope),
            expiry_date = VALUES(expiry_date),
            refresh_token_expiry_date = VALUES(refresh_token_expiry_date),
            updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
        userId,
        tokens.owner_id,
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type,
        tokens.scope,
        expiryDate,
        refreshExpiryDate
    ];

    try {
        await pool.execute(query, values);
        console.log('[RingCentralService] Tokens saved successfully');
    } catch (error) {
        console.error('[RingCentralService] Failed to save tokens', error);
        throw error;
    }
};

const getStoredTokens = async (userId) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM ring_central_tokens WHERE user_id = ?', [userId]);
        return rows[0];
    } catch (error) {
        console.error('[RingCentralService] Failed to get tokens', error);
        return null;
    }
};

const getAuthenticatedPlatform = async (userId) => {
    const tokens = await getStoredTokens(userId);
    if (!tokens) throw new Error('No RingCentral tokens found for user');

    const rcsdk = createSdk();
    const platform = rcsdk.platform();

    // Set auth data directly
    const authData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: Math.floor((tokens.expiry_date - Date.now()) / 1000),
        refresh_token_expires_in: Math.floor((tokens.refresh_token_expiry_date - Date.now()) / 1000),
        scope: tokens.scope,
        owner_id: tokens.rc_user_id
    };

    await platform.auth().setData(authData);

    if (!await platform.loggedIn()) {
        console.log('[RingCentralService] Token expired, attempting refresh logic via SDK');
        // The SDK automatically handles refresh if we call methods, but platform.loggedIn() checks validity.
        // If we force a refresh:
        try {
            await platform.refresh();
            const newTokens = await platform.auth().data();
            await saveTokens(userId, newTokens); // Update DB with new tokens
        } catch (e) {
            console.error('[RingCentralService] Refresh failed', e);
            throw new Error('RingCentral session expired. Please reconnect.');
        }
    }

    return platform;
};

const disconnect = async (userId) => {
    try {
        // Optional: Call RC logout API
        try {
            const platform = await getAuthenticatedPlatform(userId);
            await platform.logout();
        } catch (e) {
            // Ignore logout errors if token is already invalid
        }

        await pool.execute('DELETE FROM ring_central_tokens WHERE user_id = ?', [userId]);
        return true;
    } catch (error) {
        console.error('[RingCentralService] Disconnect failed', error);
        throw error;
    }
};

const getConnectionStatus = async (userId) => {
    const tokens = await getStoredTokens(userId);
    return {
        connected: !!tokens,
        connectedAt: tokens ? tokens.created_at : null
    };
};

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    saveTokens,
    getAuthenticatedPlatform,
    disconnect,
    getConnectionStatus
};
