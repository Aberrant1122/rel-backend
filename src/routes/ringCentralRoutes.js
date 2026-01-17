const express = require('express');
const router = express.Router();
const ringCentralController = require('../controllers/ringCentralController');
const protect = require('../middleware/authMiddleware');

// Public callback (browser redirect)
router.get('/ringcentral/callback', ringCentralController.handleCallback);

// Protected routes
router.use('/ringcentral', protect);
router.get('/ringcentral', ringCentralController.initiateOAuth);
router.get('/ringcentral/status', ringCentralController.getStatus);
router.post('/ringcentral/disconnect', ringCentralController.disconnect);

module.exports = router;
