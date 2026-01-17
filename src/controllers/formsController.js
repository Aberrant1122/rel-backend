const { db } = require('../config/firebase');

/**
 * Get all form submissions from 'bookings' collection
 * @route GET /api/forms/bookings
 * @access Private
 */
const getBookings = async (req, res) => {
    try {
        const bookingsSnapshot = await db.collection('bookings').get();

        const bookings = [];
        bookingsSnapshot.forEach(doc => {
            bookings.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: error.message
        });
    }
};

/**
 * Get a single booking by ID
 * @route GET /api/forms/bookings/:id
 * @access Private
 */
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection('bookings').doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking',
            error: error.message
        });
    }
};

module.exports = {
    getBookings,
    getBookingById
};
