const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// All attendance routes require authentication
router.use(authMiddleware);

// Employee routes
router.post('/attendance/check-in', attendanceController.checkIn);
router.post('/attendance/check-out', attendanceController.checkOut);
router.get('/attendance/status', attendanceController.getStatus);

// Admin routes
router.get('/attendance/today', roleMiddleware('admin'), attendanceController.getTodayAttendance);
router.get('/attendance/records', roleMiddleware('admin'), attendanceController.getAttendanceRecords);

module.exports = router;
