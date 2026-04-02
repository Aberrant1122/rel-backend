const { pool } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const notificationsService = require('../services/notificationsService');

/**
 * POST /dispatch/assign
 * Assign a driver to a reservation and send them an approval notification.
 * Status moves to 'pending_driver_approval' until driver accepts/denies.
 */
const assignDriver = async (req, res) => {
    let connection;
    try {
        const { reservation_id, driver_id } = req.body;

        if (!reservation_id || !driver_id) {
            return errorResponse(res, 400, 'reservation_id and driver_id are required');
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch reservation
        const [reservationRows] = await connection.execute(
            'SELECT id, reservation_number, reservation_status FROM reservations WHERE id = ?',
            [reservation_id]
        );

        if (reservationRows.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Reservation not found');
        }

        const reservation = reservationRows[0];

        if (!['pending', 'driver_denied'].includes(reservation.reservation_status)) {
            await connection.rollback();
            return errorResponse(res, 400, `Cannot assign driver to a reservation with status '${reservation.reservation_status}'`);
        }

        // Fetch driver (must be available)
        const [driverRows] = await connection.execute(
            `SELECT d.id, d.status, u.id AS user_id, u.name
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = ? AND d.status = 'available'`,
            [driver_id]
        );

        if (driverRows.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Driver not found or not available');
        }

        const driver = driverRows[0];

        // Update reservation — status becomes pending_driver_approval
        await connection.execute(
            `UPDATE reservations 
             SET assigned_driver_id = ?, reservation_status = 'pending_driver_approval', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [driver_id, reservation_id]
        );

        // Mark driver on_trip immediately when assigned (so they are hidden from other assignment lists)
        await connection.execute(
            `UPDATE drivers SET status = 'on_trip' WHERE id = ?`,
            [driver_id]
        );

        await connection.commit();

        // Notify driver
        try {
            await notificationsService.createNotification(
                driver.user_id,
                'trip_assigned',
                'New Trip Assignment',
                `You have been assigned trip #${reservation.reservation_number}. Please approve or deny it.`,
                reservation_id,
                'reservation'
            );
        } catch (notifErr) {
            console.error('Notification failed (non-fatal):', notifErr.message);
        }

        return successResponse(res, 200, 'Driver assigned — awaiting driver approval', {
            reservation_id,
            reservation_number: reservation.reservation_number,
            driver_id,
            driver_name: driver.name,
            status: 'pending_driver_approval'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Dispatch assignDriver error:', error);
        return errorResponse(res, 500, 'Failed to assign driver', error.message);
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /dispatch/approve/:reservation_id
 * Driver approves the assigned trip.
 */
const approveTrip = async (req, res) => {
    let connection;
    try {
        const { reservation_id } = req.params;
        const driverUserId = req.user.id;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify the calling user is the assigned driver
        const [rows] = await connection.execute(
            `SELECT r.id, r.reservation_number, r.reservation_status, r.assigned_driver_id,
                    d.id AS driver_id, d.user_id
             FROM reservations r
             JOIN drivers d ON r.assigned_driver_id = d.id
             WHERE r.id = ? AND d.user_id = ?`,
            [reservation_id, driverUserId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return errorResponse(res, 403, 'Reservation not found or you are not the assigned driver');
        }

        const row = rows[0];

        if (row.reservation_status !== 'pending_driver_approval') {
            await connection.rollback();
            return errorResponse(res, 400, `Trip is not awaiting your approval (current status: ${row.reservation_status})`);
        }

        // Approve: set reservation to 'confirmed' (accepted by driver), driver to 'on_trip'
        await connection.execute(
            `UPDATE reservations SET reservation_status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [reservation_id]
        );

        await connection.execute(
            `UPDATE drivers SET status = 'on_trip' WHERE id = ?`,
            [row.driver_id]
        );

        await connection.commit();

        // Notify admins/team (optional — notify the creator)
        try {
            const [creatorRows] = await pool.query(
                'SELECT created_by FROM reservations WHERE id = ?',
                [reservation_id]
            );
            if (creatorRows.length > 0 && creatorRows[0].created_by) {
                await notificationsService.createNotification(
                    creatorRows[0].created_by,
                    'trip_approved',
                    'Trip Approved by Driver',
                    `Driver approved trip #${row.reservation_number}.`,
                    reservation_id,
                    'reservation'
                );
            }
        } catch (notifErr) {
            console.error('Notification failed (non-fatal):', notifErr.message);
        }

        return successResponse(res, 200, 'Trip approved successfully', {
            reservation_id,
            status: 'assigned'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Dispatch approveTrip error:', error);
        return errorResponse(res, 500, 'Failed to approve trip', error.message);
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /dispatch/deny/:reservation_id
 * Driver denies the assigned trip — reservation goes back to pending_driver_approval → driver_denied.
 */
const denyTrip = async (req, res) => {
    let connection;
    try {
        const { reservation_id } = req.params;
        const driverUserId = req.user.id;
        const { reason } = req.body;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify the calling user is the assigned driver
        const [rows] = await connection.execute(
            `SELECT r.id, r.reservation_number, r.reservation_status, r.assigned_driver_id,
                    d.id AS driver_id, d.user_id
             FROM reservations r
             JOIN drivers d ON r.assigned_driver_id = d.id
             WHERE r.id = ? AND d.user_id = ?`,
            [reservation_id, driverUserId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return errorResponse(res, 403, 'Reservation not found or you are not the assigned driver');
        }

        const row = rows[0];

        if (row.reservation_status !== 'pending_driver_approval') {
            await connection.rollback();
            return errorResponse(res, 400, `Trip is not awaiting your approval (current status: ${row.reservation_status})`);
        }

        // Deny: unassign driver, set status to driver_denied, free driver back to available
        await connection.execute(
            `UPDATE reservations 
             SET reservation_status = 'driver_denied', assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [reservation_id]
        );

        await connection.execute(
            `UPDATE drivers SET status = 'available' WHERE id = ?`,
            [row.driver_id]
        );

        await connection.commit();

        // Notify creator
        try {
            const [creatorRows] = await pool.query(
                'SELECT created_by FROM reservations WHERE id = ?',
                [reservation_id]
            );
            if (creatorRows.length > 0 && creatorRows[0].created_by) {
                const reasonText = reason ? ` Reason: ${reason}` : '';
                await notificationsService.createNotification(
                    creatorRows[0].created_by,
                    'trip_denied',
                    'Trip Denied by Driver',
                    `Driver denied trip #${row.reservation_number}.${reasonText} Please assign another driver.`,
                    reservation_id,
                    'reservation'
                );
            }
        } catch (notifErr) {
            console.error('Notification failed (non-fatal):', notifErr.message);
        }

        return successResponse(res, 200, 'Trip denied — reservation is available for reassignment', {
            reservation_id,
            status: 'driver_denied'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Dispatch denyTrip error:', error);
        return errorResponse(res, 500, 'Failed to deny trip', error.message);
    } finally {
        if (connection) connection.release();
    }
};

/**
 * GET /dispatch/active
 * Returns all active trips (statuses: assigned, pending_driver_approval, in_progress)
 * with driver, vehicle, and passenger details.
 */
const getActiveTrips = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                r.id,
                r.reservation_number,
                r.reservation_status,
                r.pickup_location,
                r.dropoff_location,
                r.pickup_date,
                r.pickup_time,
                r.passenger_name,
                r.passenger_phone,
                r.passenger_count,
                r.price,
                r.payment_status,
                r.booking_type,
                r.trip_type,
                r.updated_at,
                -- Driver info
                d.id          AS driver_id,
                u.name        AS driver_name,
                u.phone       AS driver_phone,
                d.status      AS driver_status,
                -- Vehicle info
                v.label       AS vehicle_label,
                v.slug        AS vehicle_code
            FROM reservations r
            LEFT JOIN drivers  d ON r.assigned_driver_id = d.id
            LEFT JOIN users    u ON d.user_id = u.id
            LEFT JOIN vehicles v ON r.assigned_vehicle_id = v.id
            WHERE r.reservation_status IN ('assigned', 'pending_driver_approval', 'in_progress')
            ORDER BY r.pickup_date ASC, r.pickup_time ASC`
        );

        return successResponse(res, 200, 'Active trips fetched', rows);
    } catch (error) {
        console.error('getActiveTrips error:', error);
        return errorResponse(res, 500, 'Failed to fetch active trips', error.message);
    }
};

module.exports = { assignDriver, approveTrip, denyTrip, getActiveTrips };
