/**
 * RingCentral SDK Configuration
 * 
 * This module initializes and configures the RingCentral SDK for API access.
 * Supports both Sandbox (development) and Production environments.
 */

const SDK = require('@ringcentral/sdk').SDK;
require('dotenv').config();

// Determine environment (sandbox or production)
const environment = process.env.RINGCENTRAL_ENVIRONMENT || 'sandbox';
const isProduction = environment === 'production';

// Base URLs for different environments
const baseURLs = {
    sandbox: 'https://platform.devtest.ringcentral.com',
    production: 'https://platform.ringcentral.com'
};

// Initialize RingCentral SDK
const rcsdk = new SDK({
    server: baseURLs[environment],
    clientId: process.env.RINGCENTRAL_CLIENT_ID,
    clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET
});

// Required OAuth scopes for this integration
const REQUIRED_SCOPES = [
    'ReadAccounts',
    'ReadCallLog',
    'ReadCallRecording',
    'ReadContacts',
    'ReadMessages',
    'ReadPresence',
    'ReadUsers',
    'SMS',
    'VoIPCalling',
    'EditMessages',
    'EditPresence',
    'TeamMessaging',
    'VideoMeetings'
].join(' ');

// Redirect URI for OAuth callback
const REDIRECT_URI = process.env.RINGCENTRAL_REDIRECT_URI || 
    (isProduction 
        ? 'https://yourdomain.com/api/auth/ringcentral/callback'
        : 'http://localhost:3000/api/auth/ringcentral/callback'
    );

/**
 * Get authorization URL for OAuth flow
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} Authorization URL
 */
function getAuthorizationURL(state = null) {
    const authUrl = rcsdk.loginUrl({
        redirectUri: REDIRECT_URI,
        state: state || Math.random().toString(36).substring(7),
        brandId: '',
        display: '',
        prompt: ''
    });
    
    // Add scopes to the URL
    const url = new URL(authUrl);
    url.searchParams.set('scope', REQUIRED_SCOPES);
    
    return url.toString();
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Token response with access_token, refresh_token, etc.
 */
async function exchangeCodeForTokens(code) {
    try {
        const response = await rcsdk.platform().login({
            code: code,
            redirectUri: REDIRECT_URI
        });
        
        return {
            access_token: response.json().access_token,
            refresh_token: response.json().refresh_token,
            expires_in: response.json().expires_in,
            token_type: response.json().token_type || 'Bearer',
            scope: response.json().scope,
            account_id: response.json().owner_id,
            extension_id: response.json().endpoint_id
        };
    } catch (error) {
        console.error('Error exchanging code for tokens:', error);
        throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
}

/**
 * Get configured SDK instance
 * @returns {SDK} RingCentral SDK instance
 */
function getSDK() {
    return rcsdk;
}

/**
 * Get platform instance (requires authentication)
 * @param {string} accessToken - Access token
 * @returns {Object} Platform instance
 */
function getPlatform(accessToken) {
    const platform = rcsdk.platform();
    platform.auth().setData({
        access_token: accessToken,
        token_type: 'Bearer'
    });
    return platform;
}

module.exports = {
    rcsdk,
    getSDK,
    getPlatform,
    getAuthorizationURL,
    exchangeCodeForTokens,
    REQUIRED_SCOPES,
    REDIRECT_URI,
    environment,
    isProduction,
    baseURL: baseURLs[environment]
};

