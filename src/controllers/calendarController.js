/**
 * @fileoverview Calendar Controller
 * Handles calendar meeting creation and listing using OAuth2
 */

const { createMeeting, listMeetingsForDate, getEvent, deleteEvent } = require('../services/googleCalendarService');
const { successResponse, errorResponse } = require('../utils/responseUtils');

/**
 * Handle meeting creation requests.
 * POST /api/calendar/meeting
 */
const createCalendarMeeting = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            startTime, 
            endTime, 
            participants, 
            timeZone,
            leadId,
            clearLeadFields = false 
        } = req.body;
        const userId = req.user?.id || null;

        console.log('[CalendarController] Creating meeting', { 
            title, 
            userId, 
            leadId, 
            participantCount: participants?.length || 0,
            clearLeadFields 
        });

        if (!title || !startTime || !endTime) {
            return errorResponse(res, 400, 'title, startTime, and endTime are required');
        }

        // Validate participants array
        if (participants && !Array.isArray(participants)) {
            return errorResponse(res, 400, 'participants must be an array of email addresses');
        }

        // Validate email formats in participants
        if (participants && participants.length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = participants.filter(email => 
                typeof email !== 'string' || !emailRegex.test(email.trim())
            );
            
            if (invalidEmails.length > 0) {
                return errorResponse(res, 400, `Invalid email addresses: ${invalidEmails.join(', ')}`);
            }
        }

        const meeting = await createMeeting({
            title,
            description,
            startTime,
            endTime,
            participants,
            timeZone
        }, userId);

        console.log('[CalendarController] Meeting created successfully', { eventId: meeting.eventId });

        // Clear lead fields if requested and leadId is provided
        if (clearLeadFields && leadId) {
            try {
                const Lead = require('../models/Lead');
                
                // Clear specific fields that are typically cleared after meeting
                const clearData = {
                    last_message: 'Meeting scheduled - fields cleared',
                    stage: 'Contacted' // Move to contacted stage after meeting is scheduled
                };
                
                const updated = await Lead.update(leadId, clearData);
                
                if (updated) {
                    // Add timeline entry for meeting creation
                    await Lead.addTimelineEntry(leadId, {
                        event_type: 'note_added',
                        description: `Meeting scheduled: "${title}" for ${new Date(startTime).toLocaleString()}`,
                        metadata: { 
                            meetingId: meeting.eventId,
                            meetingTitle: title,
                            meetingTime: startTime,
                            participantCount: participants?.length || 0,
                            fieldsCleared: true
                        }
                    });
                    
                    console.log('[CalendarController] Lead fields cleared and timeline updated', { leadId });
                } else {
                    console.warn('[CalendarController] Lead not found for clearing fields', { leadId });
                }
            } catch (leadError) {
                console.error('[CalendarController] Failed to clear lead fields:', leadError.message);
                // Don't fail the meeting creation if lead update fails
            }
        }

        return successResponse(res, 201, 'Meeting created successfully', {
            ...meeting,
            leadUpdated: clearLeadFields && leadId ? true : false,
            participantCount: participants?.length || 0
        });
    } catch (error) {
        console.error('[CalendarController] Failed to create meeting:', error.message);

        // Handle specific error cases
        if (error.message.includes('No Google account connected') || 
            error.message.includes('reconnect your Google account')) {
            return errorResponse(res, 400, 'Google account not connected. Please connect your Google account.');
        }

        if (error.message.includes('Permission denied')) {
            return errorResponse(res, 403, error.message);
        }

        return errorResponse(
            res,
            error.statusCode || 500,
            'Unable to create meeting at this time.',
            process.env.NODE_ENV === 'development'
                ? { message: error.message }
                : undefined
        );
    }
};

/**
 * List meetings for a given date.
 * GET /api/calendar/meetings
 */
const listCalendarMeetings = async (req, res) => {
    try {
        const { date, timeZone } = req.query;
        const userId = req.user?.id || null;

        console.log('[CalendarController] Listing meetings', { date, userId });

        if (!date) {
            return errorResponse(res, 400, 'date query parameter is required (YYYY-MM-DD)');
        }

        const meetings = await listMeetingsForDate({
            date: String(date),
            timeZone: typeof timeZone === 'string' ? timeZone : undefined
        }, userId);

        console.log('[CalendarController] Meetings fetched', { count: meetings.length });

        return successResponse(res, 200, 'Meetings fetched successfully', { meetings });
    } catch (error) {
        console.error('[CalendarController] Failed to list meetings:', error.message);

        // Handle specific error cases
        if (error.message.includes('No Google account connected') || 
            error.message.includes('reconnect your Google account')) {
            return errorResponse(res, 400, 'Google account not connected. Please connect your Google account.');
        }

        if (error.message.includes('Permission denied')) {
            return errorResponse(res, 403, error.message);
        }

        return errorResponse(
            res,
            error.statusCode || 500,
            'Unable to fetch meetings at this time.',
            process.env.NODE_ENV === 'development'
                ? { message: error.message }
                : undefined
        );
    }
};

/**
 * Get a single meeting by ID.
 * GET /api/calendar/meeting/:eventId
 */
const getCalendarMeeting = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.id || null;

        console.log('[CalendarController] Getting meeting', { eventId, userId });

        if (!eventId) {
            return errorResponse(res, 400, 'eventId parameter is required');
        }

        const meeting = await getEvent(eventId, userId);

        return successResponse(res, 200, 'Meeting fetched successfully', meeting);
    } catch (error) {
        console.error('[CalendarController] Failed to get meeting:', error.message);

        if (error.message.includes('Event not found')) {
            return errorResponse(res, 404, 'Meeting not found');
        }

        // Handle specific error cases
        if (error.message.includes('No Google account connected') || 
            error.message.includes('reconnect your Google account')) {
            return errorResponse(res, 401, error.message);
        }

        return errorResponse(
            res,
            error.statusCode || 500,
            'Unable to fetch meeting at this time.',
            process.env.NODE_ENV === 'development'
                ? { message: error.message }
                : undefined
        );
    }
};

/**
 * Delete a meeting by ID.
 * DELETE /api/calendar/meeting/:eventId
 */
const deleteCalendarMeeting = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.id || null;

        console.log('[CalendarController] Deleting meeting', { eventId, userId });

        if (!eventId) {
            return errorResponse(res, 400, 'eventId parameter is required');
        }

        await deleteEvent(eventId, userId);

        return successResponse(res, 200, 'Meeting deleted successfully');
    } catch (error) {
        console.error('[CalendarController] Failed to delete meeting:', error.message);

        if (error.message.includes('Event not found')) {
            return errorResponse(res, 404, 'Meeting not found');
        }

        // Handle specific error cases
        if (error.message.includes('No Google account connected') || 
            error.message.includes('reconnect your Google account')) {
            return errorResponse(res, 401, error.message);
        }

        return errorResponse(
            res,
            error.statusCode || 500,
            'Unable to delete meeting at this time.',
            process.env.NODE_ENV === 'development'
                ? { message: error.message }
                : undefined
        );
    }
};

module.exports = {
    createCalendarMeeting,
    listCalendarMeetings,
    getCalendarMeeting,
    deleteCalendarMeeting
};
