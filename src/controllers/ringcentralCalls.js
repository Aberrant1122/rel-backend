/**
 * RingCentral Calls Controller
 * 
 * Handles Cloud Phone (VoIP) functionality: making calls, call history, call status.
 */

const { pool } = require('../config/database');
const ringcentralService = require('../services/ringCentralService');

/**
 * Make an outbound call
 * POST /api/ringcentral/calls
 * Body: { to: "+1234567890", from?: "+0987654321" }
 */
async function makeCall(req, res) {
    try {
        const userId = req.user.id;
        const { to, from } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Phone number (to) is required'
            });
        }

        // Get primary phone number if not provided
        const fromNumber = from || await ringcentralService.getPrimaryPhoneNumber(userId);

        // Make call via RingCentral API
        const callResponse = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.post('/restapi/v1.0/account/~/telephony/call-out', {
                from: { phoneNumber: fromNumber },
                to: [{ phoneNumber: to }]
            });
        });

        // Store call record in database
        const callId = callResponse.session?.id || callResponse.id;
        if (callId) {
            await pool.execute(
                `INSERT INTO calls (user_id, call_id, direction, from_number, to_number, status, start_time)
                 VALUES (?, ?, 'Outbound', ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                 status = VALUES(status),
                 start_time = VALUES(start_time)`,
                [userId, callId, fromNumber, to, callResponse.session?.status || 'Initiated']
            );
        }

        res.json({
            success: true,
            message: 'Call initiated',
            call: {
                id: callId,
                from: fromNumber,
                to: to,
                status: callResponse.session?.status || 'Initiated',
                session: callResponse.session
            }
        });
    } catch (error) {
        console.error('Error making call:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate call',
            error: error.message
        });
    }
}

/**
 * Get call history
 * GET /api/ringcentral/calls
 * Query: ?limit=50&offset=0
 */
async function getCallHistory(req, res) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Get calls from database
        const [calls] = await pool.execute(
            `SELECT * FROM calls 
             WHERE user_id = ? 
             ORDER BY start_time DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        // Also fetch from RingCentral API for latest data
        try {
            const apiCalls = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                return platform.get(`/restapi/v1.0/account/~/extension/~/call-log?perPage=${limit}&page=${Math.floor(offset / limit) + 1}`);
            });

            // Merge and update database with latest data
            if (apiCalls.records) {
                for (const call of apiCalls.records) {
                    await pool.execute(
                        `INSERT INTO calls (user_id, call_id, direction, from_number, to_number, status, duration, start_time, end_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         status = VALUES(status),
                         duration = VALUES(duration),
                         end_time = VALUES(end_time)`,
                        [
                            userId,
                            call.id,
                            call.direction,
                            call.from?.phoneNumber,
                            call.to?.phoneNumber,
                            call.result,
                            call.duration || 0,
                            call.startTime ? new Date(call.startTime) : null,
                            call.endTime ? new Date(call.endTime) : null
                        ]
                    );
                }
            }

            // Return updated calls from database
            const [updatedCalls] = await pool.execute(
                `SELECT * FROM calls 
                 WHERE user_id = ? 
                 ORDER BY start_time DESC 
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );

            res.json({
                success: true,
                calls: updatedCalls,
                total: apiCalls.paging?.totalElements || updatedCalls.length
            });
        } catch (apiError) {
            // If API fails, return database calls
            console.warn('Could not fetch calls from API, using database:', apiError);
            res.json({
                success: true,
                calls: calls,
                total: calls.length
            });
        }
    } catch (error) {
        console.error('Error getting call history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call history',
            error: error.message
        });
    }
}

/**
 * Get call details
 * GET /api/ringcentral/calls/:callId
 */
async function getCallDetails(req, res) {
    try {
        const userId = req.user.id;
        const { callId } = req.params;

        // Get from database
        const [calls] = await pool.execute(
            'SELECT * FROM calls WHERE user_id = ? AND call_id = ?',
            [userId, callId]
        );

        if (calls.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        // Try to get latest from API
        try {
            const apiCall = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                return platform.get(`/restapi/v1.0/account/~/extension/~/call-log/${callId}`);
            });

            // Update database
            await pool.execute(
                `UPDATE calls 
                 SET status = ?, duration = ?, end_time = ?, recording_url = ?, recording_id = ?
                 WHERE user_id = ? AND call_id = ?`,
                [
                    apiCall.result,
                    apiCall.duration || 0,
                    apiCall.endTime ? new Date(apiCall.endTime) : null,
                    apiCall.recording?.uri,
                    apiCall.recording?.id,
                    userId,
                    callId
                ]
            );

            res.json({
                success: true,
                call: {
                    ...calls[0],
                    ...apiCall
                }
            });
        } catch (apiError) {
            // Return database record if API fails
            res.json({
                success: true,
                call: calls[0]
            });
        }
    } catch (error) {
        console.error('Error getting call details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get call details',
            error: error.message
        });
    }
}

module.exports = {
    makeCall,
    getCallHistory,
    getCallDetails
};

