const express = require('express');
const router = express.Router();
const { getBookings, getBookingById } = require('../controllers/formsController');
const protect = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingById);

module.exports = router;
