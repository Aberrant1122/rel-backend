const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Driver self-service routes (driver role)
router.get('/me', authMiddleware, driverController.getMyProfile);
router.patch('/me/status', authMiddleware, driverController.updateMyStatus);

// Admin routes
router.get('/', roleMiddleware('admin'), driverController.getDrivers);
router.post('/', roleMiddleware('admin'), driverController.registerDriver);
router.put('/:id', roleMiddleware('admin'), driverController.updateDriver);
router.delete('/:id', roleMiddleware('admin'), driverController.deleteDriver);

module.exports = router;
