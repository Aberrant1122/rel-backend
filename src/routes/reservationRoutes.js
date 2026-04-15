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

// Stats route - Admin and Team only
reservationRoutes.get(
    '/stats',
    roleMiddleware('admin', 'team'),
    reservationController.getStats
);

// Reservation CRUD routes
reservationRoutes.post(
    '/',
    roleMiddleware('admin', 'team', 'passenger'),
    createReservationValidation,
    reservationController.createReservation
);

reservationRoutes.get(
    '/',
    roleMiddleware('admin', 'team'),
    listReservationsValidation,
    reservationController.getAllReservations
);

reservationRoutes.get(
    '/:id',
    roleMiddleware('admin', 'team', 'passenger', 'driver'),
    reservationController.getReservationById
);

reservationRoutes.put(
    '/:id',
    roleMiddleware('admin', 'team'),
    updateReservationValidation,
    reservationController.updateReservation
);

// Passenger specific routes
reservationRoutes.get(
    '/passenger/:passenger_id',
    roleMiddleware('admin', 'team', 'passenger'),
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
    roleMiddleware('admin', 'team'),
    reservationController.assignDriver
);

reservationRoutes.patch(
    '/:id/status',
    roleMiddleware('admin', 'team', 'driver'),
    reservationController.updateStatus
);

reservationRoutes.get(
    '/:id/status-logs',
    roleMiddleware('admin', 'team', 'driver'),
    reservationController.getStatusLogs
);

reservationRoutes.get(
    '/activity/recent',
    roleMiddleware('admin', 'team'),
    reservationController.getRecentActivity
);

reservationRoutes.post(
    '/:id/cancel',
    roleMiddleware('admin', 'team', 'passenger'),
    reservationController.cancelReservation
);

reservationRoutes.post(
    '/:id/send-invoice',
    roleMiddleware('admin', 'team'),
    reservationController.sendInvoiceManually
);

reservationRoutes.delete(
    '/:id',
    roleMiddleware('admin'),
    reservationController.deleteReservation
);

reservationRoutes.get('/drivers/available', reservationController.getAvailableDrivers);
module.exports = reservationRoutes;