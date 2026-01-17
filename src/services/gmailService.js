/**
 * @fileoverview Gmail Service
 * Handles Gmail API operations using OAuth2
 */

const { google } = require('googleapis');
const googleOAuthService = require('./googleOAuthService');

/**
 * Get Gmail API client with authenticated OAuth2
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<import('googleapis').gmail_v1.Gmail>} Gmail API client
 */
const getGmailClient = async (userId) => {
    console.log('[GmailService] Getting Gmail client', { userId });

    const auth = await googleOAuthService.getAuthenticatedClient(userId);
    return google.gmail({ version: 'v1', auth });
};

/**
 * List emails from Gmail
 * @param {number} [userId] - User ID (optional)
 * @param {Object} [options] - Query options
 * @param {number} [options.maxResults=50] - Maximum number of results
 * @param {string} [options.query] - Gmail search query (e.g., 'is:unread', 'from:example@gmail.com')
 * @param {string} [options.pageToken] - Page token for pagination
 * @returns {Promise<Object>} List of emails with metadata
 */
const listEmails = async (userId, options = {}) => {
    console.log('[GmailService] Listing emails', { userId, options });

    const {
        maxResults = 50,
        query = '',
        pageToken = null
    } = options;

    try {
        const gmail = await getGmailClient(userId);

        const params = {
            userId: 'me',
            maxResults: Math.min(maxResults, 500), // Gmail API limit is 500
        };

        if (query) {
            params.q = query;
        }

        if (pageToken) {
            params.pageToken = pageToken;
        }

        const response = await gmail.users.messages.list(params);

        const messages = response.data.messages || [];
        const nextPageToken = response.data.nextPageToken || null;
        const resultSizeEstimate = response.data.resultSizeEstimate || 0;

        console.log('[GmailService] Found messages', {
            count: messages.length,
            resultSizeEstimate,
            hasNextPage: !!nextPageToken
        });

        // Fetch full message details for each message
        const emailPromises = messages.map(msg => getEmailById(userId, msg.id));
        const emails = await Promise.all(emailPromises);

        return {
            emails,
            nextPageToken,
            resultSizeEstimate,
            count: emails.length
        };
    } catch (error) {
        console.error('[GmailService] Failed to list emails:', error.message);
        throw new Error(`Failed to list emails: ${error.message}`);
    }
};

/**
 * Get email by ID
 * @param {number} [userId] - User ID (optional)
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Email details
 */
const getEmailById = async (userId, messageId) => {
    console.log('[GmailService] Getting email by ID', { userId, messageId });

    try {
        const gmail = await getGmailClient(userId);

        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        const message = response.data;

        // Extract headers
        const headers = message.payload.headers || [];
        const getHeader = (name) => {
            const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return header ? header.value : '';
        };

        // Extract body content
        let bodyText = '';
        let bodyHtml = '';

        const extractBody = (part) => {
            if (!part) return;

            if (part.body && part.body.data) {
                try {
                    const data = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    if (part.mimeType === 'text/plain') {
                        bodyText = data;
                    } else if (part.mimeType === 'text/html') {
                        bodyHtml = data;
                    }
                } catch (error) {
                    console.error('[GmailService] Error decoding body data:', error.message);
                }
            }

            if (part.parts && Array.isArray(part.parts)) {
                part.parts.forEach(extractBody);
            }
        };

        extractBody(message.payload);

        // Format email data
        const email = {
            id: message.id,
            threadId: message.threadId,
            snippet: message.snippet || '',
            subject: getHeader('subject'),
            from: getHeader('from'),
            to: getHeader('to'),
            cc: getHeader('cc'),
            bcc: getHeader('bcc'),
            date: getHeader('date'),
            internalDate: message.internalDate,
            labels: message.labelIds || [],
            bodyText,
            bodyHtml,
            attachments: message.payload.parts?.filter(part => part.filename) || []
        };

        console.log('[GmailService] Email retrieved', {
            id: email.id,
            subject: email.subject,
            labels: email.labels
        });

        return email;
    } catch (error) {
        console.error('[GmailService] Failed to get email:', error.message);
        throw new Error(`Failed to get email: ${error.message}`);
    }
};

/**
 * Get email labels
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<Array>} List of labels
 */
const getLabels = async (userId) => {
    console.log('[GmailService] Getting labels', { userId });

    try {
        const gmail = await getGmailClient(userId);

        const response = await gmail.users.labels.list({
            userId: 'me'
        });

        const labels = response.data.labels || [];

        console.log('[GmailService] Found labels', { count: labels.length });

        return labels.map(label => ({
            id: label.id,
            name: label.name,
            type: label.type,
            messageListVisibility: label.messageListVisibility,
            labelListVisibility: label.labelListVisibility
        }));
    } catch (error) {
        console.error('[GmailService] Failed to get labels:', error.message);
        throw new Error(`Failed to get labels: ${error.message}`);
    }
};

module.exports = {
    listEmails,
    getEmailById,
    getLabels,
    getGmailClient
};

