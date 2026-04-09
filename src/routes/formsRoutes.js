const express = require('express');
const router = express.Router();
const { 
    getBookings, 
    getBookingById, 
    getVehicles, 
    getRateConfig, 
    submitBooking,
    confirmBookingPayment,
    upsertVehicle,
    updateRateConfig,
    deleteVehicle
} = require('../controllers/formsController');
const protect = require('../middleware/authMiddleware');

// Public routes
router.get('/vehicles', getVehicles);
router.get('/rate-config', getRateConfig);
router.post('/bookings', submitBooking);
router.post('/bookings/payment-confirm', confirmBookingPayment);

// Protected routes (Admin only)
router.use(protect);
router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingById);
router.post('/vehicles', upsertVehicle);
router.put('/vehicles/:id', upsertVehicle);
router.delete('/vehicles/:id', deleteVehicle);
router.put('/rate-config', updateRateConfig);

module.exports = router;
