/**
 * RingCentral Webhook Handlers
 * 
 * Handles incoming webhook events from RingCentral:
 * - Call events (started, ended, status changes)
 * - Message events (SMS/MMS received)
 * - Team messaging events
 */

const { pool } = require('../config/database');
const crypto = require('crypto');

/**
 * Validate webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from X-RingCentral-Signature header
 * @param {string} secret - Webhook secret from environment
 * @returns {boolean} True if signature is valid
 */
function validateSignature(payload, signature, secret) {
    if (!secret) {
        console.warn('Webhook secret not configured, skipping signature validation');
        return true; // Allow if secret not configured (development)
    }

    if (!signature) {
        return false;
    }

    // RingCentral uses HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
    );
}

/**
 * Store webhook event in database
 * @param {Object} eventData - Event data
 * @returns {Promise<number>} Event ID
 */
async function storeWebhookEvent(eventData) {
    try {
        const [result] = await pool.execute(
            `INSERT INTO webhook_events (event_type, event_id, user_id, payload, processed, created_at)
             VALUES (?, ?, ?, ?, FALSE, NOW())`,
            [
                eventData.eventType,
                eventData.eventId,
                eventData.userId || null,
                JSON.stringify(eventData.payload)
            ]
        );

        return result.insertId;
    } catch (error) {
        console.error('Error storing webhook event:', error);
        throw error;
    }
}

/**
 * Mark webhook event as processed
 * @param {number} eventId - Event ID
 */
async function markEventProcessed(eventId) {
    try {
        await pool.execute(
            'UPDATE webhook_events SET processed = TRUE WHERE id = ?',
            [eventId]
        );
    } catch (error) {
        console.error('Error marking event as processed:', error);
    }
}

/**
 * Handle call events
 * @param {Object} event - Webhook event
 */
async function handleCallEvent(event) {
    try {
        const eventType = event.eventType;
        const body = event.body;

        // Find user by account ID or extension ID
        let userId = null;
        if (body.account?.id) {
            const [users] = await pool.execute(
                'SELECT user_id FROM ringcentral_tokens WHERE account_id = ? LIMIT 1',
                [body.account.id]
            );
            if (users.length > 0) {
                userId = users[0].user_id;
            }
        }

        if (!userId) {
            console.warn('Could not find user for call event:', eventType);
            return;
        }

        const session = body.session || body;
        const callId = session.id;

        if (eventType === 'telephony-session-started') {
            // Call started
            await pool.execute(
                `INSERT INTO calls (user_id, call_id, direction, from_number, to_number, status, start_time)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                 status = VALUES(status),
                 start_time = VALUES(start_time)`,
                [
                    userId,
                    callId,
                    session.direction || 'Outbound',
                    session.from?.phoneNumber,
                    session.to?.[0]?.phoneNumber,
                    session.status || 'Initiated'
                ]
            );
        } else if (eventType === 'telephony-session-ended') {
            // Call ended
            await pool.execute(
                `UPDATE calls 
                 SET status = ?, duration = ?, end_time = NOW()
                 WHERE user_id = ? AND call_id = ?`,
                [
                    session.result || 'Completed',
                    session.duration || 0,
                    userId,
                    callId
                ]
            );
        } else if (eventType === 'telephony-session-state') {
            // Call status changed
            await pool.execute(
                `UPDATE calls 
                 SET status = ?
                 WHERE user_id = ? AND call_id = ?`,
                [
                    session.status || session.state,
                    userId,
                    callId
                ]
            );
        }

        console.log(`Processed call event: ${eventType} for call ${callId}`);
    } catch (error) {
        console.error('Error handling call event:', error);
        throw error;
    }
}

/**
 * Handle message events
 * @param {Object} event - Webhook event
 */
async function handleMessageEvent(event) {
    try {
        const body = event.body;

        // Find user by account ID or extension ID
        let userId = null;
        if (body.account?.id) {
            const [users] = await pool.execute(
                'SELECT user_id FROM ringcentral_tokens WHERE account_id = ? LIMIT 1',
                [body.account.id]
            );
            if (users.length > 0) {
                userId = users[0].user_id;
            }
        }

        if (!userId) {
            console.warn('Could not find user for message event');
            return;
        }

        const message = body.message || body;
        const messageId = message.id;
        const direction = message.direction === 'Inbound' ? 'Inbound' : 'Outbound';
        const messageType = message.attachments && message.attachments.length > 0 ? 'MMS' : 'SMS';

        // Store message
        await pool.execute(
            `INSERT INTO messages (user_id, message_id, direction, from_number, to_number, subject, message_text, message_type, attachment_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             message_text = VALUES(message_text),
             attachment_count = VALUES(attachment_count)`,
            [
                userId,
                messageId,
                direction,
                message.from?.phoneNumber,
                message.to?.[0]?.phoneNumber,
                message.subject,
                message.subject || message.text || '',
                messageType,
                message.attachments?.length || 0,
                message.creationTime ? new Date(message.creationTime) : new Date()
            ]
        );

        // Store attachments if MMS
        if (message.attachments && message.attachments.length > 0) {
            const [dbMessage] = await pool.execute(
                'SELECT id FROM messages WHERE message_id = ? AND user_id = ?',
                [messageId, userId]
            );

            if (dbMessage.length > 0) {
                for (const att of message.attachments) {
                    await pool.execute(
                        `INSERT INTO message_attachments (message_id, attachment_id, file_name, content_type, file_size, file_url)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE file_url = VALUES(file_url)`,
                        [
                            dbMessage[0].id,
                            att.id,
                            att.filename,
                            att.contentType,
                            att.size || 0,
                            att.uri || ''
                        ]
                    );
                }
            }
        }

        console.log(`Processed message event: ${messageType} ${direction} - ${messageId}`);
    } catch (error) {
        console.error('Error handling message event:', error);
        throw error;
    }
}

/**
 * Handle team messaging events
 * @param {Object} event - Webhook event
 */
async function handleTeamMessageEvent(event) {
    try {
        const body = event.body;

        // Find user by account ID
        let userId = null;
        if (body.account?.id) {
            const [users] = await pool.execute(
                'SELECT user_id FROM ringcentral_tokens WHERE account_id = ? LIMIT 1',
                [body.account.id]
            );
            if (users.length > 0) {
                userId = users[0].user_id;
            }
        }

        if (!userId) {
            console.warn('Could not find user for team message event');
            return;
        }

        const post = body.post || body;
        const messageId = post.id;
        const groupId = post.groupId;

        // Get team name
        let teamName = 'Unknown Team';
        try {
            const [existing] = await pool.execute(
                'SELECT group_name FROM team_messages WHERE group_id = ? LIMIT 1',
                [groupId]
            );
            if (existing.length > 0) {
                teamName = existing[0].group_name;
            }
        } catch (e) {
            console.warn('Could not get team name:', e);
        }

        // Store message
        await pool.execute(
            `INSERT INTO team_messages (user_id, message_id, group_id, group_name, sender_id, sender_name, message_text, message_type, attachments, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             message_text = VALUES(message_text),
             attachments = VALUES(attachments)`,
            [
                userId,
                messageId,
                groupId,
                teamName,
                post.creatorId,
                post.creatorName || 'Unknown',
                post.text || '',
                post.type || 'TextMessage',
                post.attachments ? JSON.stringify(post.attachments) : null,
                post.creationTime ? new Date(post.creationTime) : new Date()
            ]
        );

        console.log(`Processed team message event: ${messageId} in group ${groupId}`);
    } catch (error) {
        console.error('Error handling team message event:', error);
        throw error;
    }
}

/**
 * Main webhook handler
 * POST /api/webhooks/ringcentral
 */
async function handleWebhook(req, res) {
    try {
        // Get signature from header
        const signature = req.headers['x-ringcentral-signature'];
        const secret = process.env.RINGCENTRAL_WEBHOOK_SECRET;

        // Get raw body for signature validation
        const rawBody = JSON.stringify(req.body);

        // Validate signature
        if (!validateSignature(rawBody, signature, secret)) {
            console.warn('Invalid webhook signature');
            return res.status(401).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        // Store event in database
        const eventData = {
            eventType: req.body.eventType || req.body.event || 'unknown',
            eventId: req.body.uuid || req.body.id || null,
            userId: null, // Will be determined by handler
            payload: req.body
        };

        const eventId = await storeWebhookEvent(eventData);

        // Respond immediately (200 OK) to prevent retries
        res.status(200).json({
            success: true,
            message: 'Webhook received'
        });

        // Process event asynchronously
        setImmediate(async () => {
            try {
                const eventType = eventData.eventType;

                // Route to appropriate handler
                if (eventType.includes('telephony') || eventType.includes('call')) {
                    await handleCallEvent(req.body);
                } else if (eventType.includes('message') || eventType === 'message-store') {
                    await handleMessageEvent(req.body);
                } else if (eventType.includes('glip') || eventType.includes('team') || eventType.includes('post')) {
                    await handleTeamMessageEvent(req.body);
                } else {
                    console.log(`Unhandled webhook event type: ${eventType}`);
                }

                // Mark as processed
                await markEventProcessed(eventId);
            } catch (error) {
                console.error('Error processing webhook event:', error);
                // Don't mark as processed so it can be retried
            }
        });
    } catch (error) {
        console.error('Error handling webhook:', error);
        // Still return 200 to prevent retries for system errors
        res.status(200).json({
            success: false,
            message: 'Webhook received but processing failed',
            error: error.message
        });
    }
}

module.exports = {
    handleWebhook,
    validateSignature,
    storeWebhookEvent,
    markEventProcessed,
    handleCallEvent,
    handleMessageEvent,
    handleTeamMessageEvent
};

