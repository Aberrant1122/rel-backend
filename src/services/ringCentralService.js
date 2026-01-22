/**
 * RingCentral Service
 * 
 * Core service wrapper for RingCentral API calls.
 * Handles authentication, error handling, and response formatting.
 */

const { getSDK, getPlatform } = require('../config/ringcentral');
const tokenService = require('./tokenService');

/**
 * Make authenticated API request to RingCentral
 * @param {number} userId - User ID
 * @param {Function} apiCall - Function that receives platform and makes API call
 * @returns {Promise<Object>} API response
 */
async function makeAuthenticatedRequest(userId, apiCall) {
    try {
        // Get valid access token (refresh if needed)
        const accessToken = await tokenService.getValidAccessToken(userId);
        
        // Get platform instance with token
        const platform = getPlatform(accessToken);
        
        // Make API call
        const response = await apiCall(platform);
        
        return response.json();
    } catch (error) {
        console.error('RingCentral API error:', error);
        
        // Handle specific error cases
        if (error.response) {
            const status = error.response.status();
            const message = error.message || 'RingCentral API error';
            
            if (status === 401) {
                // Token invalid, try refreshing once
                try {
                    await tokenService.refreshAccessToken(userId);
                    // Retry with new token
                    const accessToken = await tokenService.getValidAccessToken(userId);
                    const platform = getPlatform(accessToken);
                    const retryResponse = await apiCall(platform);
                    return retryResponse.json();
                } catch (refreshError) {
                    throw new Error('Authentication failed. Please reconnect your RingCentral account.');
                }
            }
            
            throw new Error(`RingCentral API error (${status}): ${message}`);
        }
        
        throw new Error(`RingCentral API error: ${error.message}`);
    }
}

/**
 * Get user's account information
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Account information
 */
async function getAccountInfo(userId) {
    return makeAuthenticatedRequest(userId, async (platform) => {
        return platform.get('/restapi/v1.0/account/~');
    });
}

/**
 * Get user's extension information
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Extension information
 */
async function getExtensionInfo(userId) {
    return makeAuthenticatedRequest(userId, async (platform) => {
        return platform.get('/restapi/v1.0/account/~/extension/~');
    });
}

/**
 * Get phone numbers for user's extension
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Phone numbers
 */
async function getPhoneNumbers(userId) {
    return makeAuthenticatedRequest(userId, async (platform) => {
        const response = await platform.get('/restapi/v1.0/account/~/extension/~/phone-number');
        return response;
    });
}

/**
 * Get primary phone number for making calls
 * @param {number} userId - User ID
 * @returns {Promise<string>} Phone number
 */
async function getPrimaryPhoneNumber(userId) {
    try {
        const phoneNumbers = await getPhoneNumbers(userId);
        const numbers = phoneNumbers.records || [];
        
        // Find primary number (preferred or first available)
        const primary = numbers.find(pn => pn.primary) || numbers.find(pn => pn.usageType === 'DirectNumber') || numbers[0];
        
        if (!primary) {
            throw new Error('No phone number found for this account');
        }
        
        return primary.phoneNumber;
    } catch (error) {
        console.error('Error getting primary phone number:', error);
        throw error;
    }
}

module.exports = {
    makeAuthenticatedRequest,
    getAccountInfo,
    getExtensionInfo,
    getPhoneNumbers,
    getPrimaryPhoneNumber
};
