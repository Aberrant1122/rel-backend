const express = require('express');
const reservationRoutes = express.Router();
const reservationController = require('../controllers/reservationController');
// const authMiddleware = require('../middleware/authMiddleware');
// const { allowRoles } = require('../middleware/roleMiddleware');
const { validate } = require('express-validator');
const { createReservationValidation, listReservationsValidation, updateReservationValidation } = require('../../validation/reservationValidation');
// const {
//     createReservationValidation,
//     updateReservationValidation,
//     listReservationsValidation
// } = require('../validations/reservationValidation');

// All routes require authentication
// reservationRoutes.use(authMiddleware);

// Public routes (accessible by all authenticated users)
reservationRoutes.get('/vehicles', reservationController.getAvailableVehicles);

// Stats route - Admin and Team only
reservationRoutes.get(
    '/stats',
    // allowRoles('admin', 'team'),
    reservationController.getStats
);

// Reservation CRUD routes
reservationRoutes.post(
    '/',
    // allowRoles('admin', 'team', 'passenger'),
    createReservationValidation,
    reservationController.createReservation
);

reservationRoutes.get(
    '/',
    // allowRoles('admin', 'team'),
    listReservationsValidation,
    reservationController.getAllReservations
);

reservationRoutes.get(
    '/:id',
    // allowRoles('admin', 'team', 'passenger', 'driver'),
    reservationController.getReservationById
);

reservationRoutes.put(
    '/:id',
    // allowRoles('admin', 'team'),
    updateReservationValidation,
    reservationController.updateReservation
);

// Passenger specific routes
reservationRoutes.get(
    '/passenger/:passenger_id',
    // allowRoles('admin', 'team', 'passenger'),
    reservationController.getPassengerReservations
);

// Action routes
reservationRoutes.post(
    '/:id/assign-driver',
    // allowRoles('admin', 'team'),
    reservationController.assignDriver
);

reservationRoutes.patch(
    '/:id/status',
    // allowRoles('admin', 'team', 'driver'),
    reservationController.updateStatus
);

reservationRoutes.post(
    '/:id/cancel',
    // allowRoles('admin', 'team', 'passenger'),
    reservationController.cancelReservation
);

module.exports = reservationRoutes;