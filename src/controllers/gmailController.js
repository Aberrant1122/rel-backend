/**
 * @fileoverview Gmail Controller
 * Handles Gmail API requests
 */

const gmailService = require('../services/gmailService');
const { successResponse, errorResponse } = require('../utils/responseUtils');

/**
 * List emails
 * GET /api/gmail/emails
 */
const listEmails = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const {
            maxResults = 50,
            query = '',
            pageToken = null
        } = req.query;

        console.log('[GmailController] Listing emails', { userId, maxResults, query });

        const result = await gmailService.listEmails(userId, {
            maxResults: parseInt(maxResults),
            query,
            pageToken
        });

        return successResponse(res, 200, 'Emails retrieved successfully', result);
    } catch (error) {
        console.error('[GmailController] Failed to list emails:', error.message);

        if (error.message.includes('No Google account connected')) {
            return errorResponse(res, 401, 'Please connect your Google account first');
        }

        if (error.message.includes('refresh token')) {
            return errorResponse(res, 401, 'Please reconnect your Google account');
        }

        return errorResponse(
            res,
            500,
            'Failed to retrieve emails',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

/**
 * Get email by ID
 * GET /api/gmail/emails/:id
 */
const getEmailById = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const { id } = req.params;

        console.log('[GmailController] Getting email', { userId, id });

        if (!id) {
            return errorResponse(res, 400, 'Email ID is required');
        }

        const email = await gmailService.getEmailById(userId, id);

        return successResponse(res, 200, 'Email retrieved successfully', email);
    } catch (error) {
        console.error('[GmailController] Failed to get email:', error.message);

        if (error.message.includes('No Google account connected')) {
            return errorResponse(res, 401, 'Please connect your Google account first');
        }

        if (error.message.includes('refresh token')) {
            return errorResponse(res, 401, 'Please reconnect your Google account');
        }

        return errorResponse(
            res,
            500,
            'Failed to retrieve email',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

/**
 * Get email labels
 * GET /api/gmail/labels
 */
const getLabels = async (req, res) => {
    try {
        const userId = req.user?.id || null;

        console.log('[GmailController] Getting labels', { userId });

        const labels = await gmailService.getLabels(userId);

        return successResponse(res, 200, 'Labels retrieved successfully', labels);
    } catch (error) {
        console.error('[GmailController] Failed to get labels:', error.message);

        if (error.message.includes('No Google account connected')) {
            return errorResponse(res, 401, 'Please connect your Google account first');
        }

        if (error.message.includes('refresh token')) {
            return errorResponse(res, 401, 'Please reconnect your Google account');
        }

        return errorResponse(
            res,
            500,
            'Failed to retrieve labels',
            process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
        );
    }
};

module.exports = {
    listEmails,
    getEmailById,
    getLabels
};

