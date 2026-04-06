const { body, param, query } = require('express-validator');

const createReservationValidation = [
    body('booking_type')
        .isIn(['form', 'contract', 'manual'])
        .withMessage('Booking type must be form, contract, or manual'),
    
    body('trip_type')
        .isIn(['hourly', 'distance', 'contract'])
        .withMessage('Trip type must be hourly, distance, or contract'),
    
    body('passenger_id')
        .notEmpty().withMessage('Passenger ID is required')
        .isInt().withMessage('Passenger ID must be a number'),
    
    body('passenger_name')
        .notEmpty().withMessage('Passenger name is required')
        .isLength({ max: 255 }).withMessage('Passenger name too long'),
    
    body('passenger_email')
        .notEmpty().withMessage('Passenger email is required')
        .isEmail().withMessage('Invalid email format'),
    
    body('passenger_phone')
        .notEmpty().withMessage('Passenger phone is required')
        .matches(/^[0-9+\-\s()]+$/).withMessage('Invalid phone format'),
    
    body('pickup_location')
        .notEmpty().withMessage('Pickup location is required'),
    
    body('dropoff_location')
        .notEmpty().withMessage('Dropoff location is required'),
    
    body('pickup_date')
        .notEmpty().withMessage('Pickup date is required')
        .isISO8601().withMessage('Invalid date format'),
    
    body('pickup_time')
        .notEmpty().withMessage('Pickup time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
    
    body('vehicle_type_id')
        .notEmpty().withMessage('Vehicle type is required')
        .isInt().withMessage('Vehicle type must be a number'),
    
    body('passenger_count')
        .optional()
        .isInt({ min: 1 }).withMessage('Passenger count must be at least 1'),
    
    body('luggage_count')
        .optional()
        .isInt({ min: 0 }).withMessage('Luggage count must be 0 or more'),
    
    body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    
    // Contract specific
    body('contract_start_date')
        .if(body('booking_type').equals('contract'))
        .notEmpty().withMessage('Contract start date required')
        .isISO8601().withMessage('Invalid contract start date'),
    
    body('contract_end_date')
        .if(body('booking_type').equals('contract'))
        .notEmpty().withMessage('Contract end date required')
        .isISO8601().withMessage('Invalid contract end date')
        .custom((value, { req }) => {
            if (req.body.contract_start_date && new Date(value) < new Date(req.body.contract_start_date)) {
                throw new Error('Contract end date must be after start date');
            }
            return true;
        })
];

const updateReservationValidation = [
    param('id')
        .isInt().withMessage('Invalid reservation ID'),
    
    body('reservation_status')
        .optional()
        .isIn(['pending', 'assigned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'])
        .withMessage('Invalid reservation status'),
    
    body('payment_status')
        .optional()
        .isIn(['pending', 'paid', 'failed', 'refunded'])
        .withMessage('Invalid payment status'),
    
    body('assigned_driver_id')
        .optional()
        .isInt().withMessage('Driver ID must be a number')
];

const listReservationsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('status')
        .optional()
        .isIn(['pending', 'assigned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'])
        .withMessage('Invalid status filter'),
    
    query('booking_type')
        .optional()
        .isIn(['form', 'contract', 'manual'])
        .withMessage('Invalid booking type'),

    query('payment_status')
        .optional()
        .isIn(['pending', 'paid', 'failed', 'refunded'])
        .withMessage('Invalid payment status'),
    
    query('start_date')
        .optional()
        .isISO8601().withMessage('Invalid start date'),
    
    query('end_date')
        .optional()
        .isISO8601().withMessage('Invalid end date')
];

module.exports = {
    createReservationValidation,
    updateReservationValidation,
    listReservationsValidation
};