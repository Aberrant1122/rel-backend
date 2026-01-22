/**
 * RingCentral Video Meetings Controller
 * 
 * Handles video meetings: create meetings, list meetings, get join URLs.
 */

const { pool } = require('../config/database');
const ringcentralService = require('../services/ringcentralService');

/**
 * Create a video meeting
 * POST /api/ringcentral/meetings
 * Body: { topic: "Team Meeting", startTime: "2024-01-01T10:00:00Z", duration: 60 }
 */
async function createMeeting(req, res) {
    try {
        const userId = req.user.id;
        const { topic, startTime, duration, password } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                message: 'Meeting topic is required'
            });
        }

        // Prepare meeting payload
        const meetingPayload = {
            topic: topic,
            meetingType: 'Scheduled', // or 'Instant'
            allowJoinBeforeHost: true,
            startHostVideo: true,
            startParticipantsVideo: false,
            audioOptions: ['Phone', 'ComputerAudio']
        };

        if (startTime) {
            meetingPayload.schedule = {
                startTime: startTime,
                durationInMinutes: duration || 60
            };
        }

        if (password) {
            meetingPayload.password = password;
        }

        // Create meeting via RingCentral API
        const meetingResponse = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.post('/rcvideo/v1/meetings', meetingPayload);
        });

        // Store meeting in database
        const meetingId = meetingResponse.id;
        if (meetingId) {
            await pool.execute(
                `INSERT INTO meetings (user_id, meeting_id, topic, start_time, duration, join_url, host_join_url, password, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', NOW())`,
                [
                    userId,
                    meetingId,
                    topic,
                    startTime ? new Date(startTime) : null,
                    duration || 60,
                    meetingResponse.links?.joinUri || meetingResponse.joinUri,
                    meetingResponse.links?.startUri || meetingResponse.hostJoinUri,
                    password || null,
                ]
            );
        }

        res.json({
            success: true,
            message: 'Meeting created successfully',
            meeting: {
                id: meetingId,
                topic: topic,
                startTime: startTime,
                duration: duration || 60,
                joinUrl: meetingResponse.links?.joinUri || meetingResponse.joinUri,
                hostJoinUrl: meetingResponse.links?.startUri || meetingResponse.hostJoinUri,
                password: password,
                ...meetingResponse
            }
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create meeting',
            error: error.message
        });
    }
}

/**
 * Get list of meetings
 * GET /api/ringcentral/meetings
 * Query: ?limit=50&offset=0
 */
async function getMeetings(req, res) {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Get meetings from database
        const [meetings] = await pool.execute(
            `SELECT * FROM meetings 
             WHERE user_id = ? 
             ORDER BY start_time DESC, created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        // Also fetch from RingCentral API for latest data
        try {
            const apiMeetings = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                return platform.get(`/rcvideo/v1/meetings?perPage=${limit}&page=${Math.floor(offset / limit) + 1}`);
            });

            // Merge and update database
            if (apiMeetings.records) {
                for (const meeting of apiMeetings.records) {
                    await pool.execute(
                        `INSERT INTO meetings (user_id, meeting_id, topic, start_time, duration, join_url, host_join_url, password, status, participant_count, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         topic = VALUES(topic),
                         start_time = VALUES(start_time),
                         duration = VALUES(duration),
                         join_url = VALUES(join_url),
                         host_join_url = VALUES(host_join_url),
                         status = VALUES(status),
                         participant_count = VALUES(participant_count)`,
                        [
                            userId,
                            meeting.id,
                            meeting.topic,
                            meeting.schedule?.startTime ? new Date(meeting.schedule.startTime) : null,
                            meeting.schedule?.durationInMinutes || 60,
                            meeting.links?.joinUri || meeting.joinUri,
                            meeting.links?.startUri || meeting.hostJoinUri,
                            meeting.password || null,
                            meeting.status || 'Scheduled',
                            meeting.participants?.length || 0,
                            meeting.creationTime ? new Date(meeting.creationTime) : new Date()
                        ]
                    );
                }
            }

            // Return updated meetings
            const [updatedMeetings] = await pool.execute(
                `SELECT * FROM meetings 
                 WHERE user_id = ? 
                 ORDER BY start_time DESC, created_at DESC 
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );

            res.json({
                success: true,
                meetings: updatedMeetings,
                total: apiMeetings.paging?.totalElements || updatedMeetings.length
            });
        } catch (apiError) {
            // Return database meetings if API fails
            console.warn('Could not fetch meetings from API, using database:', apiError);
            res.json({
                success: true,
                meetings: meetings,
                total: meetings.length
            });
        }
    } catch (error) {
        console.error('Error getting meetings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get meetings',
            error: error.message
        });
    }
}

/**
 * Get meeting details
 * GET /api/ringcentral/meetings/:meetingId
 */
async function getMeetingDetails(req, res) {
    try {
        const userId = req.user.id;
        const { meetingId } = req.params;

        // Get from database
        const [meetings] = await pool.execute(
            'SELECT * FROM meetings WHERE user_id = ? AND meeting_id = ?',
            [userId, meetingId]
        );

        if (meetings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Try to get latest from API
        try {
            const apiMeeting = await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
                return platform.get(`/rcvideo/v1/meetings/${meetingId}`);
            });

            // Update database
            await pool.execute(
                `UPDATE meetings 
                 SET topic = ?, start_time = ?, duration = ?, join_url = ?, host_join_url = ?, 
                     password = ?, status = ?, participant_count = ?
                 WHERE user_id = ? AND meeting_id = ?`,
                [
                    apiMeeting.topic,
                    apiMeeting.schedule?.startTime ? new Date(apiMeeting.schedule.startTime) : null,
                    apiMeeting.schedule?.durationInMinutes || 60,
                    apiMeeting.links?.joinUri || apiMeeting.joinUri,
                    apiMeeting.links?.startUri || apiMeeting.hostJoinUri,
                    apiMeeting.password || null,
                    apiMeeting.status || 'Scheduled',
                    apiMeeting.participants?.length || 0,
                    userId,
                    meetingId
                ]
            );

            // Get updated record
            const [updated] = await pool.execute(
                'SELECT * FROM meetings WHERE user_id = ? AND meeting_id = ?',
                [userId, meetingId]
            );

            res.json({
                success: true,
                meeting: updated[0]
            });
        } catch (apiError) {
            // Return database record if API fails
            res.json({
                success: true,
                meeting: meetings[0]
            });
        }
    } catch (error) {
        console.error('Error getting meeting details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get meeting details',
            error: error.message
        });
    }
}

/**
 * Delete a meeting
 * DELETE /api/ringcentral/meetings/:meetingId
 */
async function deleteMeeting(req, res) {
    try {
        const userId = req.user.id;
        const { meetingId } = req.params;

        // Delete from RingCentral API
        await ringcentralService.makeAuthenticatedRequest(userId, async (platform) => {
            return platform.delete(`/rcvideo/v1/meetings/${meetingId}`);
        });

        // Delete from database
        await pool.execute(
            'DELETE FROM meetings WHERE user_id = ? AND meeting_id = ?',
            [userId, meetingId]
        );

        res.json({
            success: true,
            message: 'Meeting deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting meeting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete meeting',
            error: error.message
        });
    }
}

module.exports = {
    createMeeting,
    getMeetings,
    getMeetingDetails,
    deleteMeeting
};

