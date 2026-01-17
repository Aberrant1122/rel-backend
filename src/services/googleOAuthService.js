/**
 * @fileoverview Google OAuth2 Service
 * Handles OAuth2 authentication flow and token management
 */

const { google } = require('googleapis');
const { pool } = require('../config/database');

// Import types for JSDoc
/** @typedef {import('../types/googleOAuth.types').GoogleOAuthTokens} GoogleOAuthTokens */
/** @typedef {import('../types/googleOAuth.types').StoredGoogleTokens} StoredGoogleTokens */
/** @typedef {import('../types/googleOAuth.types').GoogleUserInfo} GoogleUserInfo */
/** @typedef {import('../types/googleOAuth.types').OAuthConnectionStatus} OAuthConnectionStatus */

// OAuth2 Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

// Calendar and Gmail scopes
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Validate OAuth configuration
 */
const validateConfig = () => {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }
    if (!GOOGLE_CLIENT_SECRET) {
        throw new Error('GOOGLE_CLIENT_SECRET environment variable is required');
    }
};

/**
 * Create a new OAuth2 client instance
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
const createOAuth2Client = () => {
    validateConfig();
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );
};

/**
 * Generate the Google OAuth2 authorization URL
 * @param {string} [state] - Optional state parameter for CSRF protection
 * @returns {string} Authorization URL
 */
const getAuthorizationUrl = (state) => {
    console.log('[GoogleOAuth] Generating authorization URL');
    console.log('[GoogleOAuth] Using Redirect URI:', GOOGLE_REDIRECT_URI);

    const oauth2Client = createOAuth2Client();

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: state || undefined
    });

    console.log('[GoogleOAuth] Authorization URL generated successfully');
    return url;
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from Google
 * @returns {Promise<GoogleOAuthTokens>} OAuth tokens
 */
const exchangeCodeForTokens = async (code) => {
    console.log('[GoogleOAuth] Exchanging authorization code for tokens');

    const oauth2Client = createOAuth2Client();

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('[GoogleOAuth] Token exchange successful', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiryDate: tokens.expiry_date
        });

        return {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            token_type: tokens.token_type || 'Bearer',
            expiry_date: tokens.expiry_date
        };
    } catch (error) {
        console.error('[GoogleOAuth] Token exchange failed:', error.message);
        throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
};

/**
 * Get Google user info using access token
 * @param {string} accessToken - Valid access token
 * @returns {Promise<GoogleUserInfo>} User info
 */
const getUserInfo = async (accessToken) => {
    console.log('[GoogleOAuth] Fetching user info');

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

    try {
        const { data } = await oauth2.userinfo.get();

        console.log('[GoogleOAuth] User info fetched:', { email: data.email });

        return {
            id: data.id,
            email: data.email,
            name: data.name,
            picture: data.picture
        };
    } catch (error) {
        console.error('[GoogleOAuth] Failed to fetch user info:', error.message);
        throw new Error(`Failed to fetch user info: ${error.message}`);
    }
};

/**
 * Save OAuth tokens to database
 * @param {number|null} userId - Associated user ID
 * @param {string} googleEmail - Google account email
 * @param {GoogleOAuthTokens} tokens - OAuth tokens
 * @returns {Promise<number>} Inserted/updated record ID
 */
const saveTokens = async (userId, googleEmail, tokens) => {
    console.log('[GoogleOAuth] Saving tokens to database', { userId, googleEmail });

    const query = `
        INSERT INTO google_oauth_tokens 
        (user_id, google_email, access_token, refresh_token, scope, token_type, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            access_token = VALUES(access_token),
            refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
            scope = VALUES(scope),
            token_type = VALUES(token_type),
            expiry_date = VALUES(expiry_date),
            updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
        userId,
        googleEmail,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.scope || null,
        tokens.token_type || 'Bearer',
        tokens.expiry_date || null
    ];

    try {
        const [result] = await pool.execute(query, values);
        const insertedId = result.insertId || result.affectedRows;

        console.log('[GoogleOAuth] Tokens saved successfully', { id: insertedId });
        return insertedId;
    } catch (error) {
        console.error('[GoogleOAuth] Failed to save tokens:', error.message);
        throw new Error(`Failed to save tokens: ${error.message}`);
    }
};

/**
 * Get stored tokens for a user
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<StoredGoogleTokens|null>} Stored tokens or null
 */
const getStoredTokens = async (userId) => {
    console.log('[GoogleOAuth] Fetching stored tokens', { userId });

    let query, values;

    if (userId) {
        query = 'SELECT * FROM google_oauth_tokens WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1';
        values = [userId];
    } else {
        // Get the most recently updated token (for single-user setup)
        query = 'SELECT * FROM google_oauth_tokens ORDER BY updated_at DESC LIMIT 1';
        values = [];
    }

    try {
        const [rows] = await pool.execute(query, values);

        if (rows.length === 0) {
            console.log('[GoogleOAuth] No stored tokens found');
            return null;
        }

        console.log('[GoogleOAuth] Found stored tokens', {
            googleEmail: rows[0].google_email,
            hasRefreshToken: !!rows[0].refresh_token
        });
        if (userId) {
            console.log(`Google tokens retrieved for user ${userId}`);
        }

        return rows[0];
    } catch (error) {
        console.error('[GoogleOAuth] Failed to fetch stored tokens:', error.message);
        throw new Error(`Failed to fetch stored tokens: ${error.message}`);
    }
};

/**
 * Update access token in database
 * @param {number} tokenId - Token record ID
 * @param {string} accessToken - New access token
 * @param {number} [expiryDate] - New expiry date
 */
const updateAccessToken = async (tokenId, accessToken, expiryDate) => {
    console.log('[GoogleOAuth] Updating access token', { tokenId });

    const query = `
        UPDATE google_oauth_tokens 
        SET access_token = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    try {
        await pool.execute(query, [accessToken, expiryDate || null, tokenId]);
        console.log('[GoogleOAuth] Access token updated successfully');
    } catch (error) {
        console.error('[GoogleOAuth] Failed to update access token:', error.message);
        throw new Error(`Failed to update access token: ${error.message}`);
    }
};

/**
 * Get an authenticated OAuth2 client with valid tokens
 * Automatically refreshes tokens if expired
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>} Authenticated OAuth2 client
 */
const getAuthenticatedClient = async (userId) => {
    console.log('[GoogleOAuth] Getting authenticated client', { userId });

    const storedTokens = await getStoredTokens(userId);

    if (!storedTokens) {
        throw new Error('No Google account connected. Please connect your Google account first.');
    }

    if (!storedTokens.refresh_token) {
        throw new Error('No refresh token available. Please reconnect your Google account.');
    }

    const oauth2Client = createOAuth2Client();

    // Set the stored credentials
    oauth2Client.setCredentials({
        access_token: storedTokens.access_token,
        refresh_token: storedTokens.refresh_token,
        scope: storedTokens.scope,
        token_type: storedTokens.token_type,
        expiry_date: storedTokens.expiry_date
    });

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Date.now();
    const expiryDate = storedTokens.expiry_date;
    const isExpired = expiryDate && (now >= expiryDate - 5 * 60 * 1000);

    if (isExpired) {
        console.log('[GoogleOAuth] Access token expired, refreshing...');

        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            console.log('[GoogleOAuth] Token refresh successful', {
                newExpiryDate: credentials.expiry_date
            });

            // Update the stored token in database
            await updateAccessToken(
                storedTokens.id,
                credentials.access_token,
                credentials.expiry_date
            );

            // Update the client with new credentials
            oauth2Client.setCredentials(credentials);
        } catch (error) {
            console.error('[GoogleOAuth] Token refresh failed:', error.message);
            throw new Error('Failed to refresh access token. Please reconnect your Google account.');
        }
    }

    console.log('[GoogleOAuth] Authenticated client ready');
    return oauth2Client;
};

/**
 * Delete stored tokens for a user (disconnect)
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<boolean>} Whether tokens were deleted
 */
const deleteTokens = async (userId) => {
    console.log('[GoogleOAuth] Deleting stored tokens', { userId });

    let query, values;

    if (userId) {
        query = 'DELETE FROM google_oauth_tokens WHERE user_id = ?';
        values = [userId];
    } else {
        // Delete all tokens (for single-user setup)
        query = 'DELETE FROM google_oauth_tokens';
        values = [];
    }

    try {
        const [result] = await pool.execute(query, values);
        const deleted = result.affectedRows > 0;

        console.log('[GoogleOAuth] Tokens deleted:', { deleted, count: result.affectedRows });
        return deleted;
    } catch (error) {
        console.error('[GoogleOAuth] Failed to delete tokens:', error.message);
        throw new Error(`Failed to delete tokens: ${error.message}`);
    }
};

/**
 * Get OAuth connection status
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<OAuthConnectionStatus>} Connection status
 */
const getConnectionStatus = async (userId) => {
    console.log('[GoogleOAuth] Checking connection status', { userId });

    const storedTokens = await getStoredTokens(userId);

    if (!storedTokens) {
        return {
            connected: false,
            email: null,
            connectedAt: null
        };
    }

    return {
        connected: true,
        email: storedTokens.google_email,
        connectedAt: storedTokens.created_at
    };
};

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    getUserInfo,
    saveTokens,
    getStoredTokens,
    getAuthenticatedClient,
    deleteTokens,
    getConnectionStatus,
    createOAuth2Client
};






