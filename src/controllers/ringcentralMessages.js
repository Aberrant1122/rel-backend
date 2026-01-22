/**
 * RingCentral Messages Controller
 * 
 * Handles SMS and MMS messaging: sending messages, message history, attachments.
 */

const { pool } = require('../config/database');
const ringcentralService = require('../services/ringcentralService');

/**
 * Send SMS
 * POST /api/ringcentral/messages/sms
 * Body: { to: "+1234567890", text: "Hello" }
 */
async function sendSMS(req, res) {
    try {
        const userId = req.user.id;
        const { to, text, from } = req.body;

        if (!to || !text) {
            return res.status(400).json({
                success: false,
                message: 'Phone number (to) and message text are required'
            });
        }

        // Get primary phone number if not provided
        const fromNumber = from || await ringcentralService.getPrimaryPhoneNumber(userId);

        // Send SMS via RingCentral API
        const messageResponse = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.post('/restapi/v1.0/account/~/extension/~/sms', {
                from: { phoneNumber: fromNumber },
                to: [{ phoneNumber: to }],
                text: text
            });
        });

        // Store message in database
        const messageId = messageResponse.id;
        if (messageId) {
            await pool.execute(
                `INSERT INTO messages (user_id, message_id, direction, from_number, to_number, message_text, message_type, created_at)
                 VALUES (?, ?, 'Outbound', ?, ?, ?, 'SMS', NOW())`,
                [userId, messageId, fromNumber, to, text]
            );
        }

        res.json({
            success: true,
            message: 'SMS sent successfully',
            messageData: {
                id: messageId,
                from: fromNumber,
                to: to,
                text: text,
                status: messageResponse.messageStatus || 'Sent'
            }
        });
    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send SMS',
            error: error.message
        });
    }
}

/**
 * Send MMS with attachments
 * POST /api/ringcentral/messages/mms
 * Body: { to: "+1234567890", text: "Hello", attachments: [{ filename, contentType, content }] }
 */
async function sendMMS(req, res) {
    try {
        const userId = req.user.id;
        const { to, text, attachments, from } = req.body;

        if (!to || !attachments || attachments.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number (to) and at least one attachment are required'
            });
        }

        // Get primary phone number if not provided
        const fromNumber = from || await ringcentralService.getPrimaryPhoneNumber(userId);

        // Prepare attachments for RingCentral API
        const apiAttachments = attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            content: att.content // Base64 encoded
        }));

        // Send MMS via RingCentral API
        const messageResponse = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.post('/restapi/v1.0/account/~/extension/~/sms', {
                from: { phoneNumber: fromNumber },
                to: [{ phoneNumber: to }],
                text: text || '',
                attachments: apiAttachments
            });
        });

        // Store message in database
        const messageId = messageResponse.id;
        if (messageId) {
            await pool.execute(
                `INSERT INTO messages (user_id, message_id, direction, from_number, to_number, message_text, message_type, attachment_count, created_at)
                 VALUES (?, ?, 'Outbound', ?, ?, ?, 'MMS', ?, NOW())`,
                [userId, messageId, fromNumber, to, text || '', attachments.length]
            );

            // Store attachments
            for (let i = 0; i < attachments.length; i++) {
                const att = attachments[i];
                await pool.execute(
                    `INSERT INTO message_attachments (message_id, attachment_id, file_name, content_type, file_size, file_url)
                     VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?)`,
                    [att.id || `att_${i}`, att.filename, att.contentType, att.size || 0, att.url || '']
                );
            }
        }

        res.json({
            success: true,
            message: 'MMS sent successfully',
            messageData: {
                id: messageId,
                from: fromNumber,
                to: to,
                text: text,
                attachments: attachments.length,
                status: messageResponse.messageStatus || 'Sent'
            }
        });
    } catch (error) {
        console.error('Error sending MMS:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send MMS',
            error: error.message
        });
    }
}

/**
 * Get message history
 * GET /api/ringcentral/messages
 * Query: ?limit=50&offset=0&direction=Inbound|Outbound
 */
async function getMessages(req, res) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const direction = req.query.direction; // Optional filter

        // Build query
        let query = `SELECT m.*, 
                            (SELECT COUNT(*) FROM message_attachments ma WHERE ma.message_id = m.id) as attachment_count
                     FROM messages m 
                     WHERE m.user_id = ?`;
        const params = [userId];

        if (direction) {
            query += ' AND m.direction = ?';
            params.push(direction);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [messages] = await pool.execute(query, params);

        // Also fetch from RingCentral API for latest data
        try {
            const apiMessages = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                const apiUrl = `/restapi/v1.0/account/~/extension/~/message-store?perPage=${limit}&page=${Math.floor(offset / limit) + 1}`;
                return platform.get(apiUrl);
            });

            // Merge and update database
            if (apiMessages.records) {
                for (const msg of apiMessages.records) {
                    const direction = msg.direction === 'Inbound' ? 'Inbound' : 'Outbound';
                    const messageType = msg.attachments && msg.attachments.length > 0 ? 'MMS' : 'SMS';

                    await pool.execute(
                        `INSERT INTO messages (user_id, message_id, direction, from_number, to_number, subject, message_text, message_type, attachment_count, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         message_text = VALUES(message_text),
                         attachment_count = VALUES(attachment_count)`,
                        [
                            userId,
                            msg.id,
                            direction,
                            msg.from?.phoneNumber,
                            msg.to?.[0]?.phoneNumber,
                            msg.subject,
                            msg.subject || msg.text || '',
                            messageType,
                            msg.attachments?.length || 0,
                            msg.creationTime ? new Date(msg.creationTime) : new Date()
                        ]
                    );

                    // Store attachments if MMS
                    if (msg.attachments && msg.attachments.length > 0) {
                        const [dbMessage] = await pool.execute(
                            'SELECT id FROM messages WHERE message_id = ? AND user_id = ?',
                            [msg.id, userId]
                        );

                        if (dbMessage.length > 0) {
                            for (const att of msg.attachments) {
                                await pool.execute(
                                    `INSERT INTO message_attachments (message_id, attachment_id, file_name, content_type, file_size, file_url)
                                     VALUES (?, ?, ?, ?, ?, ?)
                                     ON DUPLICATE KEY UPDATE file_url = VALUES(file_url)`,
                                    [dbMessage[0].id, att.id, att.filename, att.contentType, att.size || 0, att.uri || '']
                                );
                            }
                        }
                    }
                }
            }

            // Return updated messages
            const [updatedMessages] = await pool.execute(query, params);
            res.json({
                success: true,
                messages: updatedMessages,
                total: apiMessages.paging?.totalElements || updatedMessages.length
            });
        } catch (apiError) {
            // Return database messages if API fails
            console.warn('Could not fetch messages from API, using database:', apiError);
            res.json({
                success: true,
                messages: messages,
                total: messages.length
            });
        }
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get messages',
            error: error.message
        });
    }
}

/**
 * Get message details with attachments
 * GET /api/ringcentral/messages/:messageId
 */
async function getMessageDetails(req, res) {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        // Get message from database
        const [messages] = await pool.execute(
            'SELECT * FROM messages WHERE user_id = ? AND message_id = ?',
            [userId, messageId]
        );

        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Get attachments
        const [attachments] = await pool.execute(
            'SELECT * FROM message_attachments WHERE message_id = ?',
            [messages[0].id]
        );

        res.json({
            success: true,
            message: messages[0],
            attachments: attachments
        });
    } catch (error) {
        console.error('Error getting message details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get message details',
            error: error.message
        });
    }
}

module.exports = {
    sendSMS,
    sendMMS,
    getMessages,
    getMessageDetails
};

