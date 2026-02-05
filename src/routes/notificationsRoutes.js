const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const authMiddleware = require('../middleware/authMiddleware');

// All notification routes require authentication
router.get('/', authMiddleware, notificationsController.getNotifications);
router.patch('/:id/read', authMiddleware, notificationsController.markAsRead);
router.patch('/read-all', authMiddleware, notificationsController.markAllAsRead);
router.delete('/:id', authMiddleware, notificationsController.deleteNotification);

module.exports = router;

