/**
 * @fileoverview Type definitions for Google OAuth2 integration
 */

/**
 * @typedef {Object} GoogleOAuthTokens
 * @property {string} access_token - OAuth2 access token
 * @property {string} [refresh_token] - OAuth2 refresh token (only on first authorization)
 * @property {string} [scope] - Authorized scopes
 * @property {string} [token_type] - Token type (usually 'Bearer')
 * @property {number} [expiry_date] - Token expiry timestamp in milliseconds
 */

/**
 * @typedef {Object} StoredGoogleTokens
 * @property {number} id - Database ID
 * @property {number|null} user_id - Associated user ID
 * @property {string} google_email - Google account email
 * @property {string} access_token - OAuth2 access token
 * @property {string|null} refresh_token - OAuth2 refresh token
 * @property {string|null} scope - Authorized scopes
 * @property {string} token_type - Token type
 * @property {number|null} expiry_date - Token expiry timestamp
 * @property {Date} created_at - Record creation timestamp
 * @property {Date} updated_at - Record update timestamp
 */

/**
 * @typedef {Object} GoogleUserInfo
 * @property {string} id - Google user ID
 * @property {string} email - User email
 * @property {string} [name] - User display name
 * @property {string} [picture] - User profile picture URL
 */

/**
 * @typedef {Object} CreateMeetingInput
 * @property {string} title - Meeting title
 * @property {string} [description] - Meeting description
 * @property {string|Date} startTime - Meeting start time
 * @property {string|Date} endTime - Meeting end time
 * @property {string[]} [participants] - List of participant emails
 * @property {string} [timeZone] - Timezone (defaults to 'UTC')
 */

/**
 * @typedef {Object} CreateMeetingResult
 * @property {string} eventId - Google Calendar event ID
 * @property {string} meetLink - Google Meet link
 * @property {string} startTime - Meeting start time (ISO string)
 * @property {string} endTime - Meeting end time (ISO string)
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id - Event ID
 * @property {string} summary - Event title/summary
 * @property {string} start - Event start time
 * @property {string} end - Event end time
 * @property {string} [meetLink] - Google Meet link if available
 * @property {string} [description] - Event description
 * @property {Array<{email: string}>} [attendees] - Event attendees
 */

/**
 * @typedef {Object} ListMeetingsInput
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {string} [timeZone] - Timezone (defaults to 'UTC')
 */

/**
 * @typedef {Object} OAuthConnectionStatus
 * @property {boolean} connected - Whether Google is connected
 * @property {string|null} email - Connected Google email
 * @property {Date|null} connectedAt - When the connection was established
 */

module.exports = {};






