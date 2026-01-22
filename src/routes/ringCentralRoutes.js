const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { requireRingCentralConnection, checkRingCentralConnection } = require('../middleware/ringcentralAuth');

// Controllers
const ringcentralAuth = require('../controllers/ringcentralAuth');
const ringcentralCalls = require('../controllers/ringcentralCalls');
const ringcentralMessages = require('../controllers/ringcentralMessages');
const ringcentralTeams = require('../controllers/ringcentralTeams');
const ringcentralMeetings = require('../controllers/ringcentralMeetings');
const { handleWebhook } = require('../webhooks/ringcentralWebhooks');

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Public callback (browser redirect) - no auth required
// Note: This route is mounted at /auth, so full path is /api/auth/ringcentral/callback
router.get('/ringcentral/callback', ringcentralAuth.handleCallback);

// Protected auth routes
router.use('/ringcentral', protect);
router.get('/ringcentral', ringcentralAuth.initiateAuth);
router.get('/ringcentral/status', ringcentralAuth.getStatus);
router.delete('/ringcentral/disconnect', ringcentralAuth.disconnect);

// ============================================
// CALLS ROUTES (Cloud Phone)
// ============================================

router.use('/ringcentral/calls', protect, requireRingCentralConnection);
router.post('/ringcentral/calls', ringcentralCalls.makeCall);
router.get('/ringcentral/calls', ringcentralCalls.getCallHistory);
router.get('/ringcentral/calls/:callId', ringcentralCalls.getCallDetails);

// ============================================
// MESSAGES ROUTES (SMS/MMS)
// ============================================

router.use('/ringcentral/messages', protect, requireRingCentralConnection);
router.post('/ringcentral/messages/sms', ringcentralMessages.sendSMS);
router.post('/ringcentral/messages/mms', ringcentralMessages.sendMMS);
router.get('/ringcentral/messages', ringcentralMessages.getMessages);
router.get('/ringcentral/messages/:messageId', ringcentralMessages.getMessageDetails);

// ============================================
// TEAM MESSAGING ROUTES
// ============================================

router.use('/ringcentral/teams', protect, requireRingCentralConnection);
router.get('/ringcentral/teams', ringcentralTeams.getTeams);
router.get('/ringcentral/teams/:groupId', ringcentralTeams.getTeamDetails);
router.post('/ringcentral/teams/:groupId/messages', ringcentralTeams.sendTeamMessage);
router.get('/ringcentral/teams/:groupId/messages', ringcentralTeams.getTeamMessages);
router.get('/ringcentral/teams/messages/all', ringcentralTeams.getAllTeamMessages);

// ============================================
// VIDEO MEETINGS ROUTES
// ============================================

router.use('/ringcentral/meetings', protect, requireRingCentralConnection);
router.post('/ringcentral/meetings', ringcentralMeetings.createMeeting);
router.get('/ringcentral/meetings', ringcentralMeetings.getMeetings);
router.get('/ringcentral/meetings/:meetingId', ringcentralMeetings.getMeetingDetails);
router.delete('/ringcentral/meetings/:meetingId', ringcentralMeetings.deleteMeeting);

// ============================================
// WEBHOOKS (Public - no auth, signature validated)
// ============================================

router.post('/webhooks/ringcentral', handleWebhook);

module.exports = router;
