/**
 * @fileoverview Gmail Routes
 * Routes for Gmail API operations
 */

const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route GET /api/gmail/emails
 * @description List emails from Gmail
 * @access Private (requires authentication)
 * @query {number} [maxResults=50] - Maximum number of results
 * @query {string} [query] - Gmail search query
 * @query {string} [pageToken] - Page token for pagination
 */
router.get('/emails', authMiddleware, gmailController.listEmails);

/**
 * @route GET /api/gmail/emails/:id
 * @description Get email by ID
 * @access Private (requires authentication)
 */
router.get('/emails/:id', authMiddleware, gmailController.getEmailById);

/**
 * @route GET /api/gmail/labels
 * @description Get email labels
 * @access Private (requires authentication)
 */
router.get('/labels', authMiddleware, gmailController.getLabels);

module.exports = router;

