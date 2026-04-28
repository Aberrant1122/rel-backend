const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Get all active trips (admin/dispatcher)
router.get('/active', roleMiddleware('admin', 'dispatcher'), dispatchController.getActiveTrips);

// Admin/dispatcher assigns a driver to a reservation
router.post('/assign', roleMiddleware('admin', 'dispatcher'), dispatchController.assignDriver);

// Driver approves or denies their assigned trip
router.post('/approve/:reservation_id', roleMiddleware('driver'), dispatchController.approveTrip);
router.post('/deny/:reservation_id', roleMiddleware('driver'), dispatchController.denyTrip);

module.exports = router;
