const { pool } = require('../config/database');
const { successResponse, errorResponse, paginationResponse } = require('../utils/responseUtils');
const { generateReservationNumber } = require('../utils/reservationNumberGenerator');
const notificationsService = require('../services/notificationsService');

// Create a new reservation
const createReservation = async (req, res) => {
    let connection;
    try {
        const {
            booking_type,
            trip_type,
            passenger_id,
            passenger_name,
            passenger_email,
            passenger_phone,
            pickup_location,
            dropoff_location,
            pickup_date,
            pickup_time,
            vehicle_type_id,
            passenger_count,
            luggage_count,
            price,
            contract_start_date,
            contract_end_date,
            daily_rate,
            hourly_rate
        } = req.body;

        const created_by = req.user.id;
        const reservation_number = generateReservationNumber();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if passenger exists - if not, create one
        let actualPassengerId = passenger_id;
        
        if (!actualPassengerId || actualPassengerId === 0) {
            const [existingPassenger] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [passenger_email]
            );
            
            if (existingPassenger.length > 0) {
                actualPassengerId = existingPassenger[0].id;
            } else {
                const [result] = await connection.execute(
                    'INSERT INTO users (name, email, phone, role, password) VALUES (?, ?, ?, ?, ?)',
                    [passenger_name, passenger_email, passenger_phone, 'user', 'temp123']
                );
                actualPassengerId = result.insertId;
            }
        } else {
            const [passenger] = await connection.execute(
                'SELECT id FROM users WHERE id = ?',
                [actualPassengerId]
            );
            
            if (passenger.length === 0) {
                await connection.rollback();
                return errorResponse(res, 404, 'Passenger not found');
            }
        }

        // Check if vehicle exists and is active
        const [vehicle] = await connection.execute(
            'SELECT id FROM vehicles WHERE id = ? AND is_active = true',
            [vehicle_type_id]
        );

        if (vehicle.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Vehicle type not found or inactive');
        }

        // Insert reservation
        const [result] = await connection.execute(
            `INSERT INTO reservations (
                reservation_number, booking_type, trip_type,
                passenger_id, passenger_name, passenger_email, passenger_phone,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                vehicle_type_id, passenger_count, luggage_count, price,
                payment_status, reservation_status,
                contract_start_date, contract_end_date, daily_rate, hourly_rate,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                reservation_number, booking_type, trip_type,
                actualPassengerId, passenger_name, passenger_email, passenger_phone,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                vehicle_type_id, passenger_count || 1, luggage_count || 0, price,
                'pending', 'pending',
                contract_start_date || null, contract_end_date || null, daily_rate || null, hourly_rate || null,
                created_by
            ]
        );

        await connection.commit();

        // Fetch the created reservation
        const [newReservation] = await connection.execute(
            `SELECT r.*, 
                v.label as vehicle_type, v.slug as vehicle_code, v.passenger_capacity, v.luggage_capacity,
                u.name as creator_name
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.id = ?`,
            [result.insertId]
        );

        return successResponse(
            res,
            201,
            'Reservation created successfully',
            newReservation[0]
        );

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create reservation error:', error);
        return errorResponse(res, 500, 'Failed to create reservation', error.message);
    } finally {
        if (connection) connection.release();
    }
};

const getAllReservations = async (req, res) => {
    let connection;
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { status, booking_type, search, payment_status } = req.query;

        connection = await pool.getConnection();

        // Build WHERE clause
        let whereConditions = [];
        let queryParams = [];

        if (status) {
            whereConditions.push('reservation_status = ?');
            queryParams.push(status);
        }

        if (booking_type) {
            whereConditions.push('booking_type = ?');
            queryParams.push(booking_type);
        }

        if (payment_status) {
            whereConditions.push('payment_status = ?');
            queryParams.push(payment_status);
        }

        if (search) {
            whereConditions.push('(passenger_name LIKE ? OR passenger_email LIKE ? OR passenger_phone LIKE ? OR reservation_number LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        // Get total count with filters
        const countQuery = `SELECT COUNT(*) as total FROM reservations ${whereClause}`;
        const [countResult] = await connection.query(countQuery, queryParams);
        const total = countResult[0].total;

        // Get data with pagination and filters
        const dataQuery = `
            SELECT r.*, v.label as vehicle_type, v.slug as vehicle_code, u.name as driver_name 
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN drivers d ON r.assigned_driver_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            ${whereClause}
            ORDER BY r.created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
        `;
        const [reservations] = await connection.query(dataQuery, queryParams);

        return paginationResponse(
            res,
            reservations,
            total,
            page,
            limit,
            'Reservations retrieved successfully'
        );

    } catch (error) {
        console.error('Get reservations error:', error);
        return errorResponse(res, 500, 'Failed to retrieve reservations', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get reservation by ID
const getReservationById = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        const [reservations] = await connection.execute(
            `SELECT 
                r.*,
                v.label as vehicle_type, v.slug as vehicle_code, v.passenger_capacity, v.luggage_capacity,
                vp.per_hour as vehicle_hourly_rate, vp.base_rate as base_fare, vp.per_mile as per_mile_rate,
                d.id as driver_id,
                u_driver.name as driver_name,
                d.license_number, d.status as driver_status,
                u_creator.name as created_by_name,
                u_creator.email as created_by_email
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
            LEFT JOIN drivers d ON r.assigned_driver_id = d.id
            LEFT JOIN users u_driver ON d.user_id = u_driver.id
            LEFT JOIN users u_creator ON r.created_by = u_creator.id
            WHERE r.id = ?`,
            [id]
        );

        if (reservations.length === 0) {
            return errorResponse(res, 404, 'Reservation not found');
        }

        return successResponse(
            res,
            200,
            'Reservation retrieved successfully',
            reservations[0]
        );

    } catch (error) {
        console.error('Get reservation error:', error);
        return errorResponse(res, 500, 'Failed to retrieve reservation', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Update reservation
const updateReservation = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const updates = req.body;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if reservation exists
        const [existing] = await connection.execute(
            'SELECT id, reservation_status FROM reservations WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Reservation not found');
        }

        // Don't allow updates to completed or cancelled reservations
        if (existing[0].reservation_status === 'completed' || existing[0].reservation_status === 'cancelled') {
            await connection.rollback();
            return errorResponse(res, 400, 'Cannot update completed or cancelled reservations');
        }

        // Format date fields properly
        let formattedUpdates = { ...updates };
        
        // Handle date fields - convert empty string to null
        const dateFields = ['pickup_date', 'contract_start_date', 'contract_end_date'];
        
        for (const field of dateFields) {
            if (formattedUpdates[field] !== undefined) {
                if (formattedUpdates[field] === '' || formattedUpdates[field] === null) {
                    formattedUpdates[field] = null;
                } else {
                    // Format ISO string to YYYY-MM-DD
                    const date = new Date(formattedUpdates[field]);
                    if (!isNaN(date.getTime())) {
                        formattedUpdates[field] = date.toISOString().split('T')[0];
                    }
                }
            }
        }

        // Build update query dynamically
        const allowedFields = [
            'pickup_location', 'dropoff_location', 'pickup_date', 'pickup_time',
            'passenger_count', 'luggage_count', 'price', 'payment_status',
            'reservation_status', 'assigned_driver_id', 'assigned_vehicle_id',
            'passenger_name', 'passenger_email', 'passenger_phone', 'vehicle_type_id',
            'contract_start_date', 'contract_end_date', 'daily_rate', 'hourly_rate'
        ];

        const updateFields = [];
        const updateValues = [];

        for (const field of allowedFields) {
            if (formattedUpdates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(formattedUpdates[field]);
            }
        }

        if (updateFields.length === 0) {
            await connection.rollback();
            return errorResponse(res, 400, 'No valid fields to update');
        }

        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add id to values array
        updateValues.push(id);

        const updateQuery = `UPDATE reservations SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await connection.execute(updateQuery, updateValues);

        await connection.commit();

        // Fetch updated reservation
        const [updated] = await connection.execute(
            `SELECT r.*, v.label as vehicle_type, v.slug as vehicle_code 
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            WHERE r.id = ?`,
            [id]
        );

        return successResponse(
            res,
            200,
            'Reservation updated successfully',
            updated[0]
        );

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update reservation error:', error);
        return errorResponse(res, 500, 'Failed to update reservation', error.message);
    } finally {
        if (connection) connection.release();
    }
};
// Assign driver to reservation
const assignDriver = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { driver_id } = req.body;

        if (!driver_id) {
            return errorResponse(res, 400, 'Driver ID is required');
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if reservation exists and is pending
        const [reservation] = await connection.execute(
            'SELECT id, reservation_status FROM reservations WHERE id = ?',
            [id]
        );

        if (reservation.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Reservation not found');
        }

        if (reservation[0].reservation_status !== 'pending') {
            await connection.rollback();
            return errorResponse(res, 400, 'Only pending reservations can be assigned');
        }

        // Check if driver exists and is available
        const [driver] = await connection.execute(
            `SELECT d.id, d.status, u.id as user_id, u.name 
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND d.status = 'available'`,
            [driver_id]
        );

        if (driver.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Driver not found or not available');
        }

        // Assign driver to reservation
        await connection.execute(
            `UPDATE reservations 
            SET assigned_driver_id = ?, reservation_status = 'assigned', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [driver_id, id]
        );

        // Update driver status
        await connection.execute(
            `UPDATE drivers SET status = 'on_trip' WHERE id = ?`,
            [driver_id]
        );

        await connection.commit();

        // Create notification for driver
        try {
            await notificationsService.createNotification(
                driver[0].user_id,
                'trip_assigned',
                'New Trip Assigned',
                `You have been assigned a new trip: #${reservation[0].reservation_number || 'N/A'}. Please accept or reject it.`,
                id,
                'reservation'
            );
        } catch (notifError) {
            console.error('Failed to create notification:', notifError);
            // Don't fail the assignment if notification fails
        }

        return successResponse(
            res,
            200,
            'Driver assigned successfully',
            {
                reservation_id: id,
                driver_id,
                driver_name: driver[0].name,
                status: 'assigned'
            }
        );

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Assign driver error:', error);
        return errorResponse(res, 500, 'Failed to assign driver', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Update reservation status
const updateStatus = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { status, note } = req.body;
        const changedBy = req.user.id;
        const changedByRole = req.user.role;

        const validStatuses = ['pending', 'assigned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'pending_driver_approval', 'driver_denied'];
        
        if (!status || !validStatuses.includes(status)) {
            return errorResponse(res, 400, 'Invalid status');
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if reservation exists
        const [reservation] = await connection.execute(
            'SELECT id, reservation_status, assigned_driver_id FROM reservations WHERE id = ?',
            [id]
        );

        if (reservation.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Reservation not found');
        }

        const currentStatus = reservation[0].reservation_status;
        
        if (currentStatus === 'completed') {
            await connection.rollback();
            return errorResponse(res, 400, 'Cannot change status of completed reservation');
        }

        if (currentStatus === 'cancelled') {
            await connection.rollback();
            return errorResponse(res, 400, 'Cannot change status of cancelled reservation');
        }

        // Update status
        if (status === 'rejected') {
            await connection.execute(
                `UPDATE reservations 
                SET reservation_status = 'pending', assigned_driver_id = NULL, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
                [id]
            );
        } else {
            await connection.execute(
                `UPDATE reservations 
                SET reservation_status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
                [status, id]
            );
        }

        // Free up driver on terminal statuses
        if ((status === 'cancelled' || status === 'completed' || status === 'rejected' || status === 'driver_denied') && reservation[0].assigned_driver_id) {
            await connection.execute(
                `UPDATE drivers SET status = 'available' WHERE id = ?`,
                [reservation[0].assigned_driver_id]
            );
        }

        // Mark driver on_trip when trip starts or is confirmed/assigned
        if ((status === 'in_progress' || status === 'confirmed' || status === 'assigned' || status === 'pending_driver_approval') && reservation[0].assigned_driver_id) {
            await connection.execute(
                `UPDATE drivers SET status = 'on_trip' WHERE id = ?`,
                [reservation[0].assigned_driver_id]
            );
        }

        // Write status log
        const loggedStatus = status === 'rejected' ? 'pending' : status;
        await connection.execute(
            `INSERT INTO trip_status_logs (reservation_id, changed_by, changed_by_role, from_status, to_status, note)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, changedBy, changedByRole, currentStatus, loggedStatus, note || null]
        );

        await connection.commit();

        // Send notifications to admins/team on key driver actions
        if (status === 'completed' || status === 'in_progress') {
            try {
                const [resDetails] = await pool.query(
                    `SELECT r.reservation_number, r.passenger_name, u.name AS driver_name
                     FROM reservations r
                     LEFT JOIN drivers d ON r.assigned_driver_id = d.id
                     LEFT JOIN users u ON d.user_id = u.id
                     WHERE r.id = ?`,
                    [id]
                );
                const detail = resDetails[0];
                const driverName = detail?.driver_name || 'Driver';
                const resNum    = detail?.reservation_number || `#${id}`;
                const passenger = detail?.passenger_name || 'passenger';

                const isCompleted = status === 'completed';
                const notifType  = isCompleted ? 'trip_completed' : 'trip_started';
                const notifTitle = isCompleted ? 'Trip Completed' : 'Trip Started';
                const notifMsg   = isCompleted
                    ? `${driverName} completed trip ${resNum} for ${passenger}.`
                    : `${driverName} started trip ${resNum} and is on the way to pick up ${passenger}.`;

                const [staffRows] = await pool.query(
                    `SELECT id FROM users WHERE role IN ('admin', 'team') AND is_active = 1`
                );
                for (const staff of staffRows) {
                    await notificationsService.createNotification(
                        staff.id, notifType, notifTitle, notifMsg, id, 'reservation'
                    );
                }
            } catch (notifErr) {
                console.error('Notification failed (non-fatal):', notifErr.message);
            }
        }

        return successResponse(
            res,
            200,
            `Reservation status updated to ${status}`,
            { id, status }
        );

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update status error:', error);
        return errorResponse(res, 500, 'Failed to update status', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get status logs for a reservation
const getStatusLogs = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();

        const [logs] = await connection.execute(
            `SELECT l.*, u.name as changed_by_name
             FROM trip_status_logs l
             JOIN users u ON l.changed_by = u.id
             WHERE l.reservation_id = ?
             ORDER BY l.created_at ASC`,
            [id]
        );

        return successResponse(res, 200, 'Status logs retrieved', logs);
    } catch (error) {
        console.error('Get status logs error:', error);
        return errorResponse(res, 500, 'Failed to retrieve status logs', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get recent trip activity across all reservations (for admin dashboard)
const getRecentActivity = async (req, res) => {
    let connection;
    try {
        const limit = parseInt(req.query.limit) || 10;
        connection = await pool.getConnection();

        const [logs] = await connection.execute(
            `SELECT l.*, u.name as changed_by_name, r.reservation_number, r.passenger_name
             FROM trip_status_logs l
             JOIN users u ON l.changed_by = u.id
             JOIN reservations r ON l.reservation_id = r.id
             ORDER BY l.created_at DESC
             LIMIT ?`,
            limit
        );

        return successResponse(res, 200, 'Recent activity retrieved', logs);
    } catch (error) {
        console.error('Get recent activity error:', error);
        return errorResponse(res, 500, 'Failed to retrieve recent activity', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Cancel reservation
const cancelReservation = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if reservation exists
        const [reservation] = await connection.execute(
            'SELECT id, reservation_status, assigned_driver_id FROM reservations WHERE id = ?',
            [id]
        );

        if (reservation.length === 0) {
            await connection.rollback();
            return errorResponse(res, 404, 'Reservation not found');
        }

        if (reservation[0].reservation_status === 'completed') {
            await connection.rollback();
            return errorResponse(res, 400, 'Cannot cancel completed reservation');
        }

        if (reservation[0].reservation_status === 'cancelled') {
            await connection.rollback();
            return errorResponse(res, 400, 'Reservation already cancelled');
        }

        // Cancel reservation
        await connection.execute(
            `UPDATE reservations 
            SET reservation_status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [id]
        );

        // Free up driver if assigned
        if (reservation[0].assigned_driver_id) {
            await connection.execute(
                `UPDATE drivers SET status = 'available' WHERE id = ?`,
                [reservation[0].assigned_driver_id]
            );
        }

        await connection.commit();

        return successResponse(
            res,
            200,
            'Reservation cancelled successfully',
            { id, status: 'cancelled' }
        );

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Cancel reservation error:', error);
        return errorResponse(res, 500, 'Failed to cancel reservation', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get reservations by passenger
const getPassengerReservations = async (req, res) => {
    let connection;
    try {
        const { passenger_id } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        connection = await pool.getConnection();

        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reservations WHERE passenger_id = ?',
            [passenger_id]
        );
        const total = countResult[0].total;

        // Get passenger reservations
        const [reservations] = await connection.execute(
            `SELECT 
                r.*,
                v.label as vehicle_type, v.slug as vehicle_code,
                d.id as driver_id,
                u.name as driver_name
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN drivers d ON r.assigned_driver_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE r.passenger_id = ?
            ORDER BY r.pickup_date DESC, r.pickup_time DESC
            LIMIT ? OFFSET ?`,
            [passenger_id, parseInt(limit), offset]
        );

        return paginationResponse(
            res,
            reservations,
            total,
            page,
            limit,
            'Passenger reservations retrieved successfully'
        );

    } catch (error) {
        console.error('Get passenger reservations error:', error);
        return errorResponse(res, 500, 'Failed to retrieve passenger reservations', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get available vehicles for booking
const getAvailableVehicles = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [vehicles] = await connection.execute(
            `SELECT 
                v.id, v.slug as vehicle_code, v.label as vehicle_type, 
                v.passenger_capacity, v.luggage_capacity, 
                v.description, vp.per_hour as hourly_rate, vp.base_rate as base_fare, vp.per_mile as per_mile_rate,
                NULL as image_url
            FROM vehicles v
            LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
            WHERE v.is_active = true
            ORDER BY v.label`
        );

        return successResponse(
            res,
            200,
            'Available vehicles retrieved successfully',
            vehicles
        );

    } catch (error) {
        console.error('Get vehicles error:', error);
        return errorResponse(res, 500, 'Failed to retrieve vehicles', error.message);
    } finally {
        if (connection) connection.release();
    }
};

// Get dashboard statistics
const getStats = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Get total reservations
        const [total] = await connection.execute(
            'SELECT COUNT(*) as count FROM reservations'
        );

        // Get today's reservations
        const [todayRes] = await connection.execute(
            'SELECT COUNT(*) as count FROM reservations WHERE pickup_date = ?',
            [today]
        );

        // Get counts by status
        const [byStatus] = await connection.execute(
            `SELECT 
                reservation_status as status,
                COUNT(*) as count
            FROM reservations
            GROUP BY reservation_status`
        );

        // Get counts by booking type
        const [byType] = await connection.execute(
            `SELECT 
                booking_type as type,
                COUNT(*) as count
            FROM reservations
            GROUP BY booking_type`
        );

        // Get recent reservations (last 5)
        const [recent] = await connection.execute(
            `SELECT 
                r.id, r.reservation_number, r.passenger_name,
                r.pickup_date, r.pickup_time, r.reservation_status,
                v.label as vehicle_type
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            ORDER BY r.created_at DESC
            LIMIT 5`
        );

        return successResponse(
            res,
            200,
            'Statistics retrieved successfully',
            {
                total: total[0]?.count || 0,
                today: todayRes[0]?.count || 0,
                by_status: byStatus || [],
                by_type: byType || [],
                recent: recent || []
            }
        );

    } catch (error) {
        console.error('Get stats error:', error);
        return errorResponse(res, 500, 'Failed to retrieve statistics', error.message);
    } finally {
        if (connection) connection.release();
    }
};
const getAvailableDrivers = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [drivers] = await connection.execute(`
            SELECT 
                d.id,
                d.user_id,
                u.name,
                u.email,
                u.phone,
                d.license_number,
                d.status,
                d.vehicle_id,
                v.label as vehicle_type,
                v.slug as vehicle_code
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            WHERE d.status = 'available'
            ORDER BY u.name
        `);

        return successResponse(
            res,
            200,
            'Available drivers retrieved successfully',
            drivers
        );

    } catch (error) {
        console.error('Get available drivers error:', error);
        return errorResponse(res, 500, 'Failed to retrieve drivers', error.message);
    } finally {
        if (connection) connection.release();
    }
};

const getDriverReservations = async (req, res) => {
    let connection;
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const { status } = req.query;

        connection = await pool.getConnection();

        // Find the driver ID for this user
        const [driverRows] = await connection.execute(
            'SELECT id FROM drivers WHERE user_id = ?',
            [userId]
        );

        if (driverRows.length === 0) {
            return errorResponse(res, 404, 'Driver profile not found');
        }

        const driverId = driverRows[0].id;

        // Build WHERE clause
        let whereConditions = ['assigned_driver_id = ?'];
        let queryParams = [driverId];

        if (status) {
            whereConditions.push('reservation_status = ?');
            queryParams.push(status);
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM reservations ${whereClause}`;
        const [countResult] = await connection.query(countQuery, queryParams);
        const total = countResult[0].total;

        // Get reservations
        const dataQuery = `
            SELECT r.*, v.label as vehicle_type, v.slug as vehicle_code 
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            ${whereClause}
            ORDER BY r.pickup_date DESC, r.pickup_time DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
        const [reservations] = await connection.query(dataQuery, queryParams);

        return paginationResponse(
            res,
            reservations,
            total,
            page,
            limit,
            'Driver trips retrieved successfully'
        );
    } catch (error) {
        console.error('Get driver reservations error:', error);
        return errorResponse(res, 500, 'Failed to retrieve driver trips', error.message);
    } finally {
        if (connection) connection.release();
    }
};

const deleteReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT id, reservation_status FROM reservations WHERE id = ?', [id]);

        if (rows.length === 0) {
            return errorResponse(res, 404, 'Reservation not found');
        }

        await pool.query('DELETE FROM reservations WHERE id = ?', [id]);
        return successResponse(res, 200, 'Reservation deleted successfully');
    } catch (error) {
        console.error('Delete reservation error:', error);
        return errorResponse(res, 500, 'Failed to delete reservation', error.message);
    }
};

module.exports = {
    createReservation,
    getAllReservations,
    getReservationById,
    updateReservation,
    assignDriver,
    updateStatus,
    getStatusLogs,
    getRecentActivity,
    cancelReservation,
    deleteReservation,
    getPassengerReservations,
    getAvailableVehicles,
    getStats,
    getAvailableDrivers,
    getDriverReservations
};