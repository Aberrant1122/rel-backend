const { pool } = require('../config/database');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseUtils');

/**
 * Register a new driver
 * POST /drivers
 */
const registerDriver = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            license_number,
            license_expiry,
            vehicle_id,
            status = 'available'
        } = req.body;

        if (!name || !email || !password || !license_number) {
            return errorResponse(res, 400, 'Name, email, password, and license number are required');
        }

        const existingUser = await User.findByEmail(email);

        let user;
        if (existingUser) {
            if (existingUser.role !== 'driver') {
                return errorResponse(res, 409, 'A user with this email already exists and cannot be registered as a driver');
            }

            const [existingDriverRows] = await pool.query(
                'SELECT id FROM drivers WHERE user_id = ?',
                [existingUser.id]
            );

            if (existingUser.name !== name || existingUser.phone !== (phone || null)) {
                await pool.query(
                    'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                    [name, phone || null, existingUser.id]
                );
            }

            user = existingUser;

            if (existingDriverRows.length > 0) {
                const driverId = existingDriverRows[0].id;
                await pool.query(
                    `UPDATE drivers SET license_number = ?, license_expiry = ?, vehicle_id = ?, status = ? WHERE id = ?`,
                    [license_number, license_expiry || null, vehicle_id || null, status, driverId]
                );

                const [driverRows] = await pool.query(
                    `SELECT d.id,
                            d.user_id,
                            u.name,
                            u.email,
                            u.phone,
                            d.license_number,
                            d.license_expiry,
                            d.vehicle_id,
                            d.status,
                            d.created_at,
                            d.updated_at
                     FROM drivers d
                     JOIN users u ON d.user_id = u.id
                     WHERE d.id = ?`,
                    [driverId]
                );

                return successResponse(res, 200, 'Driver updated successfully', {
                    driver: driverRows[0]
                });
            }
        } else {
            user = await User.create({
                name,
                email,
                password,
                phone: phone || null,
                role: 'driver'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO drivers (user_id, license_number, license_expiry, vehicle_id, status)
             VALUES (?, ?, ?, ?, ?)`,
            [
                user.id,
                license_number,
                license_expiry || null,
                vehicle_id || null,
                status
            ]
        );

        const [driverRows] = await pool.query(
            `SELECT d.id,
                    d.user_id,
                    u.name,
                    u.email,
                    u.phone,
                    d.license_number,
                    d.license_expiry,
                    d.vehicle_id,
                    d.status,
                    d.created_at,
                    d.updated_at
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = ?`,
            [result.insertId]
        );

        return successResponse(res, 201, 'Driver registered successfully', {
            driver: driverRows[0]
        });
    } catch (error) {
        console.error('Register driver error:', error);
        return errorResponse(res, 500, 'Server error while registering driver');
    }
};

/**
 * Get all drivers
 * GET /drivers
 */
const getDrivers = async (req, res) => {
    try {
        const [drivers] = await pool.query(
            `SELECT d.id,
                    d.user_id,
                    u.name,
                    u.email,
                    u.phone,
                    d.license_number,
                    d.license_expiry,
                    d.vehicle_id,
                    d.status,
                    d.created_at,
                    d.updated_at
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             ORDER BY d.created_at DESC`
        );

        return successResponse(res, 200, 'Drivers retrieved successfully', {
            drivers,
            total: drivers.length
        });
    } catch (error) {
        console.error('Get drivers error:', error);
        return errorResponse(res, 500, 'Server error while retrieving drivers');
    }
};

const deleteDriver = async (req, res) => {
    const driverId = parseInt(req.params.id, 10);

    if (Number.isNaN(driverId)) {
        return errorResponse(res, 400, 'Invalid driver id');
    }

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        let [driverRows] = await connection.query(
            `SELECT d.id AS driver_id, d.user_id, u.role
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = ?`,
            [driverId]
        );

        if (driverRows.length === 0) {
            const [fallbackRows] = await connection.query(
                `SELECT d.id AS driver_id, d.user_id, u.role
                 FROM drivers d
                 JOIN users u ON d.user_id = u.id
                 WHERE d.user_id = ?`,
                [driverId]
            );

            if (fallbackRows.length === 0) {
                await connection.rollback();
                connection.release();
                return errorResponse(res, 404, 'Driver not found');
            }

            driverRows = fallbackRows;
        }

        const driver = driverRows[0];
        await connection.query('DELETE FROM drivers WHERE id = ?', [driver.driver_id]);

        if (driver.role === 'driver') {
            await connection.query('DELETE FROM users WHERE id = ?', [driver.user_id]);
        }

        await connection.commit();
        connection.release();

        return successResponse(res, 200, 'Driver deleted successfully');
    } catch (error) {
        console.error('Delete driver error:', error);
        return errorResponse(res, 500, 'Server error while deleting driver');
    }
};

const updateDriver = async (req, res) => {
    const driverId = parseInt(req.params.id, 10);
    const {
        name,
        phone,
        license_number,
        license_expiry,
        vehicle_id,
        status
    } = req.body;

    if (Number.isNaN(driverId)) {
        return errorResponse(res, 400, 'Invalid driver id');
    }

    try {
        const [driverRows] = await pool.query(
            'SELECT user_id FROM drivers WHERE id = ?',
            [driverId]
        );

        if (driverRows.length === 0) {
            return errorResponse(res, 404, 'Driver not found');
        }

        const userId = driverRows[0].user_id;

        // Update user info if provided
        if (name !== undefined || phone !== undefined) {
            const updates = [];
            const values = [];
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                values.push(phone || null);
            }
            if (updates.length > 0) {
                values.push(userId);
                await pool.query(
                    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                    values
                );
            }
        }

        // Update driver info if provided
        const driverUpdates = [];
        const driverValues = [];
        if (license_number !== undefined) {
            driverUpdates.push('license_number = ?');
            driverValues.push(license_number);
        }
        if (license_expiry !== undefined) {
            driverUpdates.push('license_expiry = ?');
            driverValues.push(license_expiry || null);
        }
        if (vehicle_id !== undefined) {
            driverUpdates.push('vehicle_id = ?');
            driverValues.push(vehicle_id || null);
        }
        if (status !== undefined) {
            driverUpdates.push('status = ?');
            driverValues.push(status);
        }

        if (driverUpdates.length > 0) {
            driverValues.push(driverId);
            await pool.query(
                `UPDATE drivers SET ${driverUpdates.join(', ')} WHERE id = ?`,
                driverValues
            );
        }

        // Fetch updated driver
        const [updatedDriverRows] = await pool.query(
            `SELECT d.id,
                    d.user_id,
                    u.name,
                    u.email,
                    u.phone,
                    d.license_number,
                    d.license_expiry,
                    d.vehicle_id,
                    d.status,
                    d.created_at,
                    d.updated_at
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = ?`,
            [driverId]
        );

        return successResponse(res, 200, 'Driver updated successfully', {
            driver: updatedDriverRows[0]
        });
    } catch (error) {
        console.error('Update driver error:', error);
        return errorResponse(res, 500, 'Server error while updating driver');
    }
};

/**
 * Driver updates their own availability status
 * PATCH /drivers/me/status
 */
const updateMyStatus = async (req, res) => {
    const { status } = req.body;
    const userId = req.user.id;

    const allowed = ['available', 'off_duty'];
    if (!status || !allowed.includes(status)) {
        return errorResponse(res, 400, `Status must be one of: ${allowed.join(', ')}`);
    }

    try {
        const [rows] = await pool.query('SELECT id, status FROM drivers WHERE user_id = ?', [userId]);
        if (rows.length === 0) return errorResponse(res, 404, 'Driver profile not found');

        // Don't allow going off_duty while on a trip
        if (rows[0].status === 'on_trip' && status !== 'available') {
            return errorResponse(res, 400, 'Cannot change status while on a trip');
        }

        await pool.query('UPDATE drivers SET status = ? WHERE user_id = ?', [status, userId]);

        return successResponse(res, 200, 'Status updated', { status });
    } catch (error) {
        console.error('Update my status error:', error);
        return errorResponse(res, 500, 'Server error');
    }
};

/**
 * Get the driver's own profile
 * GET /drivers/me
 */
const getMyProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(
            `SELECT d.id, d.user_id, u.name, u.email, u.phone,
                    d.license_number, d.license_expiry, d.vehicle_id, d.status
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.user_id = ?`,
            [userId]
        );
        if (rows.length === 0) return errorResponse(res, 404, 'Driver profile not found');
        return successResponse(res, 200, 'Profile retrieved', rows[0]);
    } catch (error) {
        return errorResponse(res, 500, 'Server error');
    }
};

module.exports = {
    registerDriver,
    getDrivers,
    deleteDriver,
    updateDriver,
    updateMyStatus,
    getMyProfile,
};
