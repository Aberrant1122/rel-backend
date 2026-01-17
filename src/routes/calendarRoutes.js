/**
 * @fileoverview Calendar Routes
 * Routes for Google Calendar operations (requires OAuth2 authentication)
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const calendarController = require('../controllers/calendarController');

// All calendar routes require authentication
router.use(authMiddleware);

/**
 * @route POST /api/calendar/meeting
 * @description Create a new calendar meeting with Google Meet link
 * @access Private
 * @body {string} title - Meeting title (required)
 * @body {string} [description] - Meeting description
 * @body {string} startTime - Start time (ISO 8601 format, required)
 * @body {string} endTime - End time (ISO 8601 format, required)
 * @body {string[]} [participants] - Array of participant email addresses
 * @body {string} [timeZone] - Timezone (defaults to 'UTC')
 */
router.post('/calendar/meeting', calendarController.createCalendarMeeting);

/**
 * @route GET /api/calendar/meetings
 * @description List calendar meetings for a specific date
 * @access Private
 * @query {string} date - Date in YYYY-MM-DD format (required)
 * @query {string} [timeZone] - Timezone (defaults to 'UTC')
 */
router.get('/calendar/meetings', calendarController.listCalendarMeetings);

/**
 * @route GET /api/calendar/meeting/:eventId
 * @description Get a single calendar meeting by ID
 * @access Private
 * @param {string} eventId - Google Calendar event ID
 */
router.get('/calendar/meeting/:eventId', calendarController.getCalendarMeeting);

/**
 * @route DELETE /api/calendar/meeting/:eventId
 * @description Delete a calendar meeting by ID
 * @access Private
 * @param {string} eventId - Google Calendar event ID
 */
router.delete('/calendar/meeting/:eventId', calendarController.deleteCalendarMeeting);

module.exports = router;
