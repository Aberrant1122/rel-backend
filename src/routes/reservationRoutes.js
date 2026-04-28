const express = require('express');
const reservationRoutes = express.Router();
const reservationController = require('../controllers/reservationController');
const authMiddleware = require('../middleware/authMiddleware');
// const { allowRoles } = require('../middleware/roleMiddleware');
const { validate } = require('express-validator');
const { createReservationValidation, listReservationsValidation, updateReservationValidation } = require('../../validation/reservationValidation');
const roleMiddleware = require('../middleware/roleMiddleware');
// const {
//     createReservationValidation,
//     updateReservationValidation,
//     listReservationsValidation
// } = require('../validations/reservationValidation');

// All routes require authentication
reservationRoutes.use(authMiddleware);

// Public routes (accessible by all authenticated users)
reservationRoutes.get('/vehicles', reservationController.getAvailableVehicles);

// Stats route - Admin and Dispatcher only
reservationRoutes.get(
    '/stats',
    roleMiddleware('admin', 'dispatcher'),
    reservationController.getStats
);

// Reservation CRUD routes
reservationRoutes.post(
    '/',
    roleMiddleware('admin', 'dispatcher', 'passenger'),
    createReservationValidation,
    reservationController.createReservation
);

reservationRoutes.get(
    '/',
    roleMiddleware('admin', 'dispatcher'),
    listReservationsValidation,
    reservationController.getAllReservations
);

reservationRoutes.get(
    '/:id',
    roleMiddleware('admin', 'dispatcher', 'passenger', 'driver'),
    reservationController.getReservationById
);

reservationRoutes.put(
    '/:id',
    roleMiddleware('admin', 'dispatcher'),
    updateReservationValidation,
    reservationController.updateReservation
);

// Passenger specific routes
reservationRoutes.get(
    '/passenger/:passenger_id',
    roleMiddleware('admin', 'dispatcher', 'passenger'),
    reservationController.getPassengerReservations
);

// Driver specific routes
reservationRoutes.get(
    '/driver/trips',
    roleMiddleware('driver'),
    reservationController.getDriverReservations
);

// Action routes
reservationRoutes.post(
    '/:id/assign-driver',
    roleMiddleware('admin', 'dispatcher'),
    reservationController.assignDriver
);

reservationRoutes.patch(
    '/:id/status',
    roleMiddleware('admin', 'dispatcher', 'driver'),
    reservationController.updateStatus
);

reservationRoutes.get(
    '/:id/status-logs',
    roleMiddleware('admin', 'dispatcher', 'driver'),
    reservationController.getStatusLogs
);

reservationRoutes.get(
    '/activity/recent',
    roleMiddleware('admin', 'dispatcher'),
    reservationController.getRecentActivity
);

reservationRoutes.post(
    '/:id/cancel',
    roleMiddleware('admin', 'dispatcher', 'passenger'),
    reservationController.cancelReservation
);

reservationRoutes.post(
    '/:id/send-invoice',
    roleMiddleware('admin', 'dispatcher'),
    reservationController.sendInvoiceManually
);

reservationRoutes.delete(
    '/:id',
    roleMiddleware('admin'),
    reservationController.deleteReservation
);

reservationRoutes.get('/drivers/available', reservationController.getAvailableDrivers);
module.exports = reservationRoutes;