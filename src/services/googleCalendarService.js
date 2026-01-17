/**
 * @fileoverview Google Calendar Service
 * Uses OAuth2 authentication (user consent flow)
 * NO service accounts - uses user's own Google Calendar
 */

const { google } = require('googleapis');
const googleOAuthService = require('./googleOAuthService');

// Import types for JSDoc
/** @typedef {import('../types/googleOAuth.types').CreateMeetingInput} CreateMeetingInput */
/** @typedef {import('../types/googleOAuth.types').CreateMeetingResult} CreateMeetingResult */
/** @typedef {import('../types/googleOAuth.types').CalendarEvent} CalendarEvent */
/** @typedef {import('../types/googleOAuth.types').ListMeetingsInput} ListMeetingsInput */

/**
 * Get authenticated Google Calendar client
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<import('googleapis').calendar_v3.Calendar>} Authenticated calendar client
 */
const getCalendarClient = async (userId) => {
    console.log('[GoogleCalendar] Getting authenticated calendar client');
    
    const oauth2Client = await googleOAuthService.getAuthenticatedClient(userId);
    
    return google.calendar({
        version: 'v3',
        auth: oauth2Client
    });
};

/**
 * Convert a date string or Date object to an ISO string. Throws if invalid.
 * @param {string|Date} value - Date value
 * @returns {string} ISO date string
 */
const toIsoDateTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date provided for meeting.');
    }
    return date.toISOString();
};

/**
 * Build attendees list from participant emails.
 * @param {string[]} participants - Array of email addresses
 * @returns {Array<{email: string}>} Formatted attendees array
 */
const buildAttendees = (participants) => {
    if (!Array.isArray(participants)) {
        return [];
    }

    const uniqueEmails = Array.from(
        new Set(
            participants
                .filter((email) => typeof email === 'string')
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean)
        )
    );

    return uniqueEmails.map((email) => ({ email }));
};

/**
 * Create a Google Calendar meeting with Meet link and reminders.
 * @param {CreateMeetingInput} input - Meeting details
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<CreateMeetingResult>} Created meeting details
 */
const createMeeting = async (input, userId) => {
    const {
        title,
        description = '',
        startTime,
        endTime,
        participants = [],
        timeZone = 'UTC'
    } = input;

    console.log('[GoogleCalendar] Creating meeting', { title, userId });

    if (!title || !startTime || !endTime) {
        throw new Error('Title, startTime, and endTime are required to schedule a meeting.');
    }

    const startDateTime = toIsoDateTime(startTime);
    const endDateTime = toIsoDateTime(endTime);

    if (new Date(endDateTime) <= new Date(startDateTime)) {
        throw new Error('endTime must be after startTime.');
    }

    const attendees = buildAttendees(participants);
    const requestId = `crm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const eventRequest = {
        calendarId: 'primary', // Use user's primary calendar
        requestBody: {
            summary: title,
            description,
            start: { dateTime: startDateTime, timeZone },
            end: { dateTime: endDateTime, timeZone },
            attendees,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 10 }
                ]
            },
            conferenceData: {
                createRequest: {
                    requestId,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            }
        },
        conferenceDataVersion: 1,
        sendUpdates: 'all'
    };

    try {
        console.log('[GoogleCalendar] Creating calendar event', {
            title,
            start: startDateTime,
            end: endDateTime,
            attendeeCount: attendees.length
        });

        const calendar = await getCalendarClient(userId);
        const { data } = await calendar.events.insert(eventRequest);

        const meetLink =
            data.hangoutLink ||
            data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ||
            '';

        console.log('[GoogleCalendar] Meeting created successfully', {
            eventId: data.id,
            hasMeetLink: !!meetLink
        });

        return {
            eventId: data.id,
            meetLink,
            startTime: data.start?.dateTime || startDateTime,
            endTime: data.end?.dateTime || endDateTime
        };
    } catch (error) {
        console.error('[GoogleCalendar] Error creating meeting:', error.message);
        
        // Check for specific error types
        if (error.code === 401 || error.message?.includes('invalid_grant')) {
            throw new Error('Google authentication expired. Please reconnect your Google account.');
        }
        
        if (error.code === 403) {
            throw new Error('Permission denied. Please ensure you have granted calendar access.');
        }
        
        throw error;
    }
};

/**
 * List calendar meetings for a specific day.
 * @param {ListMeetingsInput} params - Query parameters
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<CalendarEvent[]>} Array of calendar events
 */
const listMeetingsForDate = async ({ date, timeZone }, userId) => {
    console.log('[GoogleCalendar] Listing meetings', { date, timeZone, userId });

    if (!date) {
        throw new Error('date is required to list meetings.');
    }

    const tz = timeZone || 'UTC';

    // Build timeMin and timeMax for the whole day in the provided time zone.
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);

    try {
        const calendar = await getCalendarClient(userId);
        
        console.log('[GoogleCalendar] Fetching events', {
            date,
            timeZone: tz,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString()
        });

        const { data } = await calendar.events.list({
            calendarId: 'primary', // Use user's primary calendar
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: tz
        });

        const events = data.items || [];

        console.log('[GoogleCalendar] Found events', { count: events.length });

        return events.map((event) => {
            const meetLink =
                event.hangoutLink ||
                event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ||
                '';

            return {
                id: event.id,
                summary: event.summary || '(No title)',
                start: event.start?.dateTime || event.start?.date || '',
                end: event.end?.dateTime || event.end?.date || '',
                meetLink,
                description: event.description || '',
                attendees: event.attendees || []
            };
        });
    } catch (error) {
        console.error('[GoogleCalendar] Error listing meetings:', error.message);
        
        // Check for specific error types
        if (error.code === 401 || error.message?.includes('invalid_grant')) {
            throw new Error('Google authentication expired. Please reconnect your Google account.');
        }
        
        if (error.code === 403) {
            throw new Error('Permission denied. Please ensure you have granted calendar access.');
        }
        
        throw error;
    }
};

/**
 * Get a single calendar event by ID.
 * @param {string} eventId - Event ID
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<CalendarEvent>} Calendar event
 */
const getEvent = async (eventId, userId) => {
    console.log('[GoogleCalendar] Getting event', { eventId, userId });

    if (!eventId) {
        throw new Error('eventId is required.');
    }

    try {
        const calendar = await getCalendarClient(userId);
        
        const { data } = await calendar.events.get({
            calendarId: 'primary',
            eventId: eventId
        });

        const meetLink =
            data.hangoutLink ||
            data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ||
            '';

        console.log('[GoogleCalendar] Event retrieved', { eventId });

        return {
            id: data.id,
            summary: data.summary || '(No title)',
            start: data.start?.dateTime || data.start?.date || '',
            end: data.end?.dateTime || data.end?.date || '',
            meetLink,
            description: data.description || '',
            attendees: data.attendees || []
        };
    } catch (error) {
        console.error('[GoogleCalendar] Error getting event:', error.message);
        
        if (error.code === 404) {
            throw new Error('Event not found.');
        }
        
        throw error;
    }
};

/**
 * Delete a calendar event by ID.
 * @param {string} eventId - Event ID
 * @param {number} [userId] - User ID (optional)
 * @returns {Promise<boolean>} Whether the event was deleted
 */
const deleteEvent = async (eventId, userId) => {
    console.log('[GoogleCalendar] Deleting event', { eventId, userId });

    if (!eventId) {
        throw new Error('eventId is required.');
    }

    try {
        const calendar = await getCalendarClient(userId);
        
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId,
            sendUpdates: 'all'
        });

        console.log('[GoogleCalendar] Event deleted successfully', { eventId });
        return true;
    } catch (error) {
        console.error('[GoogleCalendar] Error deleting event:', error.message);
        
        if (error.code === 404) {
            throw new Error('Event not found.');
        }
        
        throw error;
    }
};

module.exports = {
    createMeeting,
    listMeetingsForDate,
    getEvent,
    deleteEvent
};
