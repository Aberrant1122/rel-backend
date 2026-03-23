const { pool } = require('../config/database');
const { successResponse, errorResponse, paginationResponse } = require('../utils/responseUtils');
const { generateReservationNumber } = require('../utils/reservationNumberGenerator');

class ReservationController {
    
    // Create a new reservation
    async createReservation(req, res) {
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

            // Check if passenger exists
            const [passenger] = await connection.execute(
                'SELECT id FROM users WHERE id = ? AND role = "passenger"',
                [passenger_id]
            );

            if (passenger.length === 0) {
                await connection.rollback();
                return errorResponse(res, 404, 'Passenger not found');
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
                    passenger_id, passenger_name, passenger_email, passenger_phone,
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
                    v.vehicle_type, v.vehicle_code, v.passenger_capacity, v.luggage_capacity,
                    CONCAT(u.first_name, ' ', u.last_name) as creator_name
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
    }

    // Get all reservations with filters
    async getAllReservations(req, res) {
        let connection;
        try {
            const {
                page = 1,
                limit = 10,
                status,
                booking_type,
                passenger_id,
                driver_id,
                start_date,
                end_date
            } = req.query;

            const offset = (page - 1) * limit;
            
            let whereConditions = [];
            let queryParams = [];

            // Build WHERE clause based on filters
            if (status) {
                whereConditions.push('r.reservation_status = ?');
                queryParams.push(status);
            }

            if (booking_type) {
                whereConditions.push('r.booking_type = ?');
                queryParams.push(booking_type);
            }

            if (passenger_id) {
                whereConditions.push('r.passenger_id = ?');
                queryParams.push(passenger_id);
            }

            if (driver_id) {
                whereConditions.push('r.assigned_driver_id = ?');
                queryParams.push(driver_id);
            }

            if (start_date && end_date) {
                whereConditions.push('r.pickup_date BETWEEN ? AND ?');
                queryParams.push(start_date, end_date);
            } else if (start_date) {
                whereConditions.push('r.pickup_date >= ?');
                queryParams.push(start_date);
            } else if (end_date) {
                whereConditions.push('r.pickup_date <= ?');
                queryParams.push(end_date);
            }

            const whereClause = whereConditions.length > 0 
                ? 'WHERE ' + whereConditions.join(' AND ') 
                : '';

            connection = await pool.getConnection();

            // Get total count
            const [countResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM reservations r ${whereClause}`,
                queryParams
            );
            const total = countResult[0].total;

            // Get paginated reservations
            const [reservations] = await connection.execute(
                `SELECT 
                    r.*,
                    v.vehicle_type, v.vehicle_code, v.passenger_capacity, v.luggage_capacity,
                    d.id as driver_id,
                    CONCAT(u.first_name, ' ', u.last_name) as driver_name,
                    u.phone as driver_phone
                FROM reservations r
                LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
                LEFT JOIN drivers d ON r.assigned_driver_id = d.id
                LEFT JOIN users u ON d.user_id = u.id
                ${whereClause}
                ORDER BY r.pickup_date DESC, r.pickup_time DESC
                LIMIT ? OFFSET ?`,
                [...queryParams, parseInt(limit), parseInt(offset)]
            );

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
    }

    // Get reservation by ID
    async getReservationById(req, res) {
        let connection;
        try {
            const { id } = req.params;

            connection = await pool.getConnection();

            const [reservations] = await connection.execute(
                `SELECT 
                    r.*,
                    v.vehicle_type, v.vehicle_code, v.passenger_capacity, v.luggage_capacity,
                    v.hourly_rate as vehicle_hourly_rate, v.base_fare, v.per_mile_rate,
                    d.id as driver_id,
                    CONCAT(u_driver.first_name, ' ', u_driver.last_name) as driver_name,
                    u_driver.phone as driver_phone,
                    d.license_number, d.status as driver_status,
                    CONCAT(u_creator.first_name, ' ', u_creator.last_name) as created_by_name,
                    u_creator.email as created_by_email
                FROM reservations r
                LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
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
    }

    // Update reservation
    async updateReservation(req, res) {
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

            // Build update query dynamically
            const allowedFields = [
                'pickup_location', 'dropoff_location', 'pickup_date', 'pickup_time',
                'passenger_count', 'luggage_count', 'price', 'payment_status',
                'reservation_status', 'assigned_driver_id', 'assigned_vehicle_id'
            ];

            const updateFields = [];
            const updateValues = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
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
                `SELECT r.*, v.vehicle_type, v.vehicle_code 
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
    }

    // Assign driver to reservation
    async assignDriver(req, res) {
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
                `SELECT d.id, d.status, u.first_name, u.last_name 
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

            return successResponse(
                res,
                200,
                'Driver assigned successfully',
                {
                    reservation_id: id,
                    driver_id,
                    driver_name: `${driver[0].first_name} ${driver[0].last_name}`,
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
    }

    // Update reservation status
    async updateStatus(req, res) {
        let connection;
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
            
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

            // Validate status transition
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
            await connection.execute(
                `UPDATE reservations 
                SET reservation_status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
                [status, id]
            );

            // If cancelling and driver assigned, free up the driver
            if (status === 'cancelled' && reservation[0].assigned_driver_id) {
                await connection.execute(
                    `UPDATE drivers SET status = 'available' WHERE id = ?`,
                    [reservation[0].assigned_driver_id]
                );
            }

            // If completed, update driver status
            if (status === 'completed' && reservation[0].assigned_driver_id) {
                await connection.execute(
                    `UPDATE drivers SET status = 'available' WHERE id = ?`,
                    [reservation[0].assigned_driver_id]
                );
            }

            await connection.commit();

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
    }

    // Cancel reservation
    async cancelReservation(req, res) {
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
    }

    // Get reservations by passenger
    async getPassengerReservations(req, res) {
        let connection;
        try {
            const { passenger_id } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const offset = (page - 1) * limit;

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
                    v.vehicle_type, v.vehicle_code,
                    d.id as driver_id,
                    CONCAT(u.first_name, ' ', u.last_name) as driver_name
                FROM reservations r
                LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
                LEFT JOIN drivers d ON r.assigned_driver_id = d.id
                LEFT JOIN users u ON d.user_id = u.id
                WHERE r.passenger_id = ?
                ORDER BY r.pickup_date DESC, r.pickup_time DESC
                LIMIT ? OFFSET ?`,
                [passenger_id, parseInt(limit), parseInt(offset)]
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
    }

    // Get available vehicles for booking
    async getAvailableVehicles(req, res) {
        let connection;
        try {
            connection = await pool.getConnection();

            const [vehicles] = await connection.execute(
                `SELECT 
                    id, vehicle_code, vehicle_type, 
                    passenger_capacity, luggage_capacity, 
                    description, hourly_rate, base_fare, per_mile_rate,
                    image_url
                FROM vehicles 
                WHERE is_active = true
                ORDER BY vehicle_type`
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
    }

    // Get dashboard statistics
    async getStats(req, res) {
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
                    v.vehicle_type
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
                    total: total[0].count,
                    today: todayRes[0].count,
                    by_status: byStatus,
                    by_type: byType,
                    recent
                }
            );

        } catch (error) {
            console.error('Get stats error:', error);
            return errorResponse(res, 500, 'Failed to retrieve statistics', error.message);
        } finally {
            if (connection) connection.release();
        }
    }
}

module.exports = new ReservationController();