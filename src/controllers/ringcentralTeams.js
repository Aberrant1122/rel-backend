/**
 * RingCentral Team Messaging Controller
 * 
 * Handles team messaging (chat): list teams, send messages, get chat history.
 */

const { pool } = require('../config/database');
const ringcentralService = require('../services/ringcentralService');

/**
 * Get list of teams/groups
 * GET /api/ringcentral/teams
 */
async function getTeams(req, res) {
    try {
        const userId = req.user.id;

        const teams = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.get('/restapi/v1.0/glip/groups?recordCount=100');
        });

        res.json({
            success: true,
            teams: teams.records || []
        });
    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get teams',
            error: error.message
        });
    }
}

/**
 * Get team details
 * GET /api/ringcentral/teams/:groupId
 */
async function getTeamDetails(req, res) {
    try {
        const userId = req.user.id;
        const { groupId } = req.params;

        const team = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.get(`/restapi/v1.0/glip/groups/${groupId}`);
        });

        res.json({
            success: true,
            team: team
        });
    } catch (error) {
        console.error('Error getting team details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team details',
            error: error.message
        });
    }
}

/**
 * Send message to team
 * POST /api/ringcentral/teams/:groupId/messages
 * Body: { text: "Hello team" }
 */
async function sendTeamMessage(req, res) {
    try {
        const userId = req.user.id;
        const { groupId } = req.params;
        const { text, attachments } = req.body;

        if (!text && (!attachments || attachments.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Message text or attachments are required'
            });
        }

        // Prepare message payload
        const messagePayload = {
            groupId: groupId,
            text: text || ''
        };

        if (attachments && attachments.length > 0) {
            messagePayload.attachments = attachments.map(att => ({
                type: att.type || 'File',
                filename: att.filename,
                contentType: att.contentType,
                content: att.content // Base64 encoded
            }));
        }

        // Send message via RingCentral API
        const messageResponse = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.post('/restapi/v1.0/glip/posts', messagePayload);
        });

        // Store message in database
        const messageId = messageResponse.id;
        if (messageId) {
            // Get team name
            let teamName = 'Unknown Team';
            try {
                const team = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                    return platform.get(`/restapi/v1.0/glip/groups/${groupId}`);
                });
                teamName = team.name || teamName;
            } catch (e) {
                console.warn('Could not get team name:', e);
            }

            await pool.execute(
                `INSERT INTO team_messages (user_id, message_id, group_id, group_name, sender_id, sender_name, message_text, message_type, attachments, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    userId,
                    messageId,
                    groupId,
                    teamName,
                    messageResponse.creatorId || userId.toString(),
                    messageResponse.creatorName || 'You',
                    text || '',
                    'TextMessage',
                    attachments ? JSON.stringify(attachments) : null
                ]
            );
        }

        res.json({
            success: true,
            message: 'Message sent successfully',
            messageData: messageResponse
        });
    } catch (error) {
        console.error('Error sending team message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send team message',
            error: error.message
        });
    }
}

/**
 * Get team messages (chat history)
 * GET /api/ringcentral/teams/:groupId/messages
 * Query: ?limit=50&recordId=...
 */
async function getTeamMessages(req, res) {
    try {
        const userId = req.user.id;
        const { groupId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const recordId = req.query.recordId; // For pagination

        // Build API URL
        let apiUrl = `/restapi/v1.0/glip/posts?groupId=${groupId}&recordCount=${limit}`;
        if (recordId) {
            apiUrl += `&recordId=${recordId}`;
        }

        const messages = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.get(apiUrl);
        });

        // Store messages in database
        if (messages.records) {
            for (const msg of messages.records) {
                // Get team name
                let teamName = 'Unknown Team';
                try {
                    const team = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                        return platform.get(`/restapi/v1.0/glip/groups/${groupId}`);
                    });
                    teamName = team.name || teamName;
                } catch (e) {
                    // Use existing team name from database if available
                    const [existing] = await pool.execute(
                        'SELECT group_name FROM team_messages WHERE group_id = ? LIMIT 1',
                        [groupId]
                    );
                    if (existing.length > 0) {
                        teamName = existing[0].group_name;
                    }
                }

                await pool.execute(
                    `INSERT INTO team_messages (user_id, message_id, group_id, group_name, sender_id, sender_name, message_text, message_type, attachments, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     message_text = VALUES(message_text),
                     attachments = VALUES(attachments)`,
                    [
                        userId,
                        msg.id,
                        groupId,
                        teamName,
                        msg.creatorId,
                        msg.creatorName || 'Unknown',
                        msg.text || '',
                        msg.type || 'TextMessage',
                        msg.attachments ? JSON.stringify(msg.attachments) : null,
                        msg.creationTime ? new Date(msg.creationTime) : new Date()
                    ]
                );
            }
        }

        // Get from database for consistent format
        const [dbMessages] = await pool.execute(
            `SELECT * FROM team_messages 
             WHERE user_id = ? AND group_id = ? 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [userId, groupId, limit]
        );

        res.json({
            success: true,
            messages: dbMessages.reverse(), // Reverse to show oldest first
            navigation: messages.navigation || {}
        });
    } catch (error) {
        console.error('Error getting team messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team messages',
            error: error.message
        });
    }
}

/**
 * Get all team messages for user (across all teams)
 * GET /api/ringcentral/teams/messages
 * Query: ?limit=50&offset=0
 */
async function getAllTeamMessages(req, res) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const [messages] = await pool.execute(
            `SELECT * FROM team_messages 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        res.json({
            success: true,
            messages: messages,
            total: messages.length
        });
    } catch (error) {
        console.error('Error getting all team messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team messages',
            error: error.message
        });
    }
}

module.exports = {
    getTeams,
    getTeamDetails,
    sendTeamMessage,
    getTeamMessages,
    getAllTeamMessages
};

