const Lead = require('../models/Lead');
const whatsappService = require('../services/whatsappService');

/**
 * GET /api/webhook/whatsapp
 * Webhook verification endpoint for WhatsApp Cloud API
 */
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    console.log('📞 Webhook verification request:', { mode, token });

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.error('❌ Webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
};

/**
 * POST /api/webhook/whatsapp
 * Receive incoming WhatsApp messages
 */
const receiveMessage = async (req, res) => {
    try {
        // Acknowledge receipt immediately
        res.status(200).json({ success: true });

        const body = req.body;

        console.log('📨 Incoming webhook:', JSON.stringify(body, null, 2));

        // Check if this is a WhatsApp message event
        if (body.object !== 'whatsapp_business_account') {
            console.log('⚠️ Not a WhatsApp business account event');
            return;
        }

        // Extract message data
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value?.messages || value.messages.length === 0) {
            console.log('⚠️ No messages in webhook payload');
            return;
        }

        const message = value.messages[0];
        const contact = value.contacts?.[0];

        // Extract message details
        const messageId = message.id;
        const from = message.from; // Phone number with country code
        const messageType = message.type;
        const timestamp = message.timestamp;

        // Extract message text based on type
        let messageText = '';
        if (messageType === 'text') {
            messageText = message.text?.body || '';
        } else if (messageType === 'image') {
            messageText = `[Image] ${message.image?.caption || 'No caption'}`;
        } else if (messageType === 'document') {
            messageText = `[Document] ${message.document?.filename || 'No filename'}`;
        } else if (messageType === 'audio') {
            messageText = '[Audio message]';
        } else if (messageType === 'video') {
            messageText = `[Video] ${message.video?.caption || 'No caption'}`;
        } else {
            messageText = `[${messageType} message]`;
        }

        // Extract contact name
        const contactName = contact?.profile?.name || from;

        console.log('📱 Message details:', {
            from,
            name: contactName,
            type: messageType,
            text: messageText,
            messageId
        });

        // Process the message and update/create lead
        await processIncomingMessage({
            phone: from,
            name: contactName,
            messageText,
            messageId,
            messageType,
            timestamp
        });

        // Mark message as read (optional)
        await whatsappService.markAsRead(messageId);

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        // Don't send error response as we already sent 200
    }
};

/**
 * Process incoming message and update lead
 */
async function processIncomingMessage(data) {
    const { phone, name, messageText, messageId, messageType, timestamp } = data;

    try {
        // Check if lead exists
        let lead = await Lead.findByPhone(phone);

        if (lead) {
            console.log(`📋 Existing lead found: ${lead.name} (ID: ${lead.id})`);

            // Update lead stage to "Contacted" if they write again
            const newStage = lead.stage === 'New' || lead.stage === 'Incoming' ? 'Contacted' : lead.stage;
            
            await Lead.update(lead.id, {
                last_message: messageText,
                stage: newStage
            });

            // Add stage change to timeline if stage changed
            if (newStage !== lead.stage) {
                await Lead.addTimelineEntry(lead.id, {
                    event_type: 'stage_changed',
                    description: `Stage changed from ${lead.stage} to ${newStage}`,
                    metadata: { from: lead.stage, to: newStage, reason: 'Customer replied' }
                });
            }

            lead.id = lead.id; // Keep the ID for message logging
        } else {
            console.log(`✨ Creating new lead: ${name}`);

            // Create new lead with "Incoming" stage
            const leadId = await Lead.create({
                name: name,
                phone: phone,
                stage: 'Incoming',
                source: 'WhatsApp',
                last_message: messageText
            });

            lead = { id: leadId, name, phone };

            // Add creation timeline entry
            await Lead.addTimelineEntry(leadId, {
                event_type: 'message_received',
                description: `New lead created from WhatsApp message`,
                metadata: { source: 'WhatsApp', initial_message: messageText }
            });
        }

        // Save message to database
        await Lead.addMessage(lead.id, {
            message_id: messageId,
            direction: 'inbound',
            message_text: messageText,
            message_type: messageType,
            status: 'delivered'
        });

        // Add timeline entry for message
        await Lead.addTimelineEntry(lead.id, {
            event_type: 'message_received',
            description: `Received WhatsApp message: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`,
            metadata: { message_id: messageId, message_type: messageType }
        });

        console.log(`✅ Lead processed successfully: ${lead.name} (ID: ${lead.id})`);

        // Optional: Send auto-reply
        // await sendAutoReply(phone, name);

    } catch (error) {
        console.error('❌ Error processing incoming message:', error);
        throw error;
    }
}

/**
 * Optional: Send automatic reply to new leads
 */
async function sendAutoReply(phone, name) {
    try {
        const message = `Hi ${name}! 👋 Thank you for reaching out. We've received your message and will get back to you shortly.`;
        await whatsappService.sendMessage(phone, message);
        console.log(`✅ Auto-reply sent to ${name}`);
    } catch (error) {
        console.error('❌ Failed to send auto-reply:', error);
    }
}

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message to a lead
 */
const sendMessage = async (req, res) => {
    try {
        const { phone, message, leadId } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        // Send message via WhatsApp
        const result = await whatsappService.sendMessage(phone, message);

        if (result.success && leadId) {
            // Save message to database
            await Lead.addMessage(leadId, {
                message_id: result.messageId,
                direction: 'outbound',
                message_text: message,
                message_type: 'text',
                status: 'sent'
            });

            // Add timeline entry
            await Lead.addTimelineEntry(leadId, {
                event_type: 'message_sent',
                description: `Sent WhatsApp message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
                metadata: { message_id: result.messageId }
            });

            // Update last message
            await Lead.update(leadId, {
                last_message: message
            });
        }

        res.json({
            success: true,
            messageId: result.messageId,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({
            success: false,
            error: error.error || error.message || 'Failed to send message'
        });
    }
};

/**
 * GET /api/leads
 * Get all leads with pagination
 */
const getLeads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filters = {
            stage: req.query.stage,
            source: req.query.source
        };

        const result = await Lead.getAll(page, limit, filters);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error fetching leads:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leads'
        });
    }
};

/**
 * GET /api/leads/:id
 * Get lead details with messages and timeline
 */
const getLeadDetails = async (req, res) => {
    try {
        const leadId = req.params.id;
        const lead = await Lead.getLeadWithDetails(leadId);

        if (!lead) {
            return res.status(404).json({
                success: false,
                error: 'Lead not found'
            });
        }

        res.json({
            success: true,
            lead
        });
    } catch (error) {
        console.error('❌ Error fetching lead details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch lead details'
        });
    }
};

module.exports = {
    verifyWebhook,
    receiveMessage,
    sendMessage,
    getLeads,
    getLeadDetails
};
