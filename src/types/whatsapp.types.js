/**
 * @typedef {Object} WhatsAppMessage
 * @property {string} id - Message ID
 * @property {string} from - Sender phone number
 * @property {string} timestamp - Message timestamp
 * @property {string} type - Message type (text, image, document, etc.)
 * @property {Object} [text] - Text message content
 * @property {string} [text.body] - Text message body
 * @property {Object} [image] - Image message content
 * @property {string} [image.id] - Image ID
 * @property {string} [image.caption] - Image caption
 */

/**
 * @typedef {Object} WhatsAppContact
 * @property {string} wa_id - WhatsApp ID
 * @property {Object} profile - Contact profile
 * @property {string} profile.name - Contact name
 */

/**
 * @typedef {Object} WhatsAppWebhookPayload
 * @property {string} object - Object type (whatsapp_business_account)
 * @property {Array<WhatsAppEntry>} entry - Webhook entries
 */

/**
 * @typedef {Object} WhatsAppEntry
 * @property {string} id - Entry ID
 * @property {Array<WhatsAppChange>} changes - Changes array
 */

/**
 * @typedef {Object} WhatsAppChange
 * @property {Object} value - Change value
 * @property {Array<WhatsAppMessage>} [value.messages] - Messages array
 * @property {Array<WhatsAppContact>} [value.contacts] - Contacts array
 * @property {Object} [value.metadata] - Metadata
 */

/**
 * @typedef {Object} Lead
 * @property {number} id - Lead ID
 * @property {string} name - Lead name
 * @property {string} phone - Phone number
 * @property {string} [email] - Email address
 * @property {LeadStage} stage - Lead stage
 * @property {LeadSource} source - Lead source
 * @property {string} [last_message] - Last message text
 * @property {Date} [last_message_at] - Last message timestamp
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Update timestamp
 */

/**
 * @typedef {'New'|'Incoming'|'Contacted'|'Qualified'|'Proposal'|'Second Wing'|'Won'|'Lost'} LeadStage
 */

/**
 * @typedef {'WhatsApp'|'Website'|'Referral'|'Cold Call'|'Email'|'Social Media'|'Other'} LeadSource
 */

/**
 * @typedef {Object} LeadMessage
 * @property {number} id - Message ID
 * @property {number} lead_id - Lead ID
 * @property {string} [message_id] - WhatsApp message ID
 * @property {'inbound'|'outbound'} direction - Message direction
 * @property {string} message_text - Message text
 * @property {string} message_type - Message type
 * @property {'sent'|'delivered'|'read'|'failed'} status - Message status
 * @property {Date} created_at - Creation timestamp
 */

/**
 * @typedef {Object} TimelineEntry
 * @property {number} id - Timeline entry ID
 * @property {number} lead_id - Lead ID
 * @property {TimelineEventType} event_type - Event type
 * @property {string} description - Event description
 * @property {Object} [metadata] - Additional metadata
 * @property {Date} created_at - Creation timestamp
 */

/**
 * @typedef {'message_received'|'message_sent'|'stage_changed'|'note_added'|'call_made'|'email_sent'} TimelineEventType
 */

/**
 * @typedef {Object} SendMessageRequest
 * @property {string} phone - Recipient phone number
 * @property {string} message - Message text
 * @property {number} [leadId] - Lead ID (optional)
 */

/**
 * @typedef {Object} SendMessageResponse
 * @property {boolean} success - Success status
 * @property {string} [messageId] - WhatsApp message ID
 * @property {string} [message] - Response message
 * @property {string} [error] - Error message
 */

module.exports = {};
