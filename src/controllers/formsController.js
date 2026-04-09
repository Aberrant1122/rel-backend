const { pool } = require('../config/database');

/**
 * Get all vehicles with pricing and service classes
 * @route GET /api/forms/vehicles
 * @access Public
 */
const getVehicles = async (req, res) => {
    try {
        // Check if sort_order column exists
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'vehicles' 
            AND COLUMN_NAME = 'sort_order'
        `);
        
        const hasSortOrder = columns.length > 0;
        
        const [vehicles] = await pool.query(`
            SELECT v.*, 
                   vp.base_rate, vp.per_mile, vp.per_hour, vp.per_minute,
                   GROUP_CONCAT(vsc.service_class) as service_classes
            FROM vehicles v
            LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
            LEFT JOIN vehicle_service_classes vsc ON v.id = vsc.vehicle_id
            WHERE v.is_active = TRUE
            GROUP BY v.id
            ${hasSortOrder ? 'ORDER BY v.sort_order ASC' : 'ORDER BY v.id ASC'}
        `);

        const ALL_SERVICE_CLASSES = ['hourly', 'airport', 'event', 'corporate'];

        // Format features and service_classes
        const formattedVehicles = vehicles.map(v => ({
            ...v,
            features: typeof v.features === 'string' ? JSON.parse(v.features) : v.features,
            // Fallback to all service classes if none are mapped (prevents vehicles from being invisible)
            service_classes: v.service_classes ? v.service_classes.split(',') : ALL_SERVICE_CLASSES,
            base_rate: v.base_rate !== null ? parseFloat(v.base_rate) : null,
            per_mile: v.per_mile !== null ? parseFloat(v.per_mile) : null,
            per_hour: v.per_hour !== null ? parseFloat(v.per_hour) : null,
            per_minute: v.per_minute !== null ? parseFloat(v.per_minute) : null
        }));

        res.json({
            success: true,
            data: formattedVehicles
        });
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch vehicles', error: error.message });
    }
};

/**
 * Get global rate configuration
 * @route GET /api/forms/rate-config
 * @access Public
 */
const getRateConfig = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM form_rate_config WHERE id = 1');
        const config = rows[0];

        if (config) {
            if (typeof config.service_multipliers === 'string') {
                config.service_multipliers = JSON.parse(config.service_multipliers);
            }
            if (typeof config.enabled_service_types === 'string') {
                config.enabled_service_types = JSON.parse(config.enabled_service_types);
            }
            config.tax_rate = parseFloat(config.tax_rate || 0);
            config.cc_fee_rate = parseFloat(config.cc_fee_rate || 0);
            config.gratuity_rate = parseFloat(config.gratuity_rate || 0);
        }

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error fetching rate config:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch rate config', error: error.message });
    }
};

/** Normalize payment_status for ENUM columns */
function normalizePaymentStatus(value) {
    const v = (value && String(value).toLowerCase()) || 'pending';
    return ['pending', 'paid', 'failed', 'refunded'].includes(v) ? v : 'pending';
}

const submitBooking = async (req, res) => {
    try {
        const bookingData = req.body;
        // Must match Stripe Checkout client_reference_id (frontend sends booking_... id)
        const bookingRef =
            (bookingData.booking_ref && String(bookingData.booking_ref).trim()) ||
            `BR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Helper function to extract correct price format
        const price = bookingData.total_amount ? parseFloat(bookingData.total_amount) : 0;
        const paymentStatus = normalizePaymentStatus(bookingData.payment_status);
        const bookingStatus = bookingData.status || 'pending';
        
        // 1. Find or create passenger in users table
        let passengerId;
        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [bookingData.email]);
        
        if (users.length > 0) {
            passengerId = users[0].id;
        } else {
            // Create a generic passenger user
            const [newUser] = await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [bookingData.full_name || 'Guest', bookingData.email, Math.random().toString(36).slice(-8), 'user']
            );
            passengerId = newUser.insertId;
        }

        const metadata = bookingData.metadata || {};
        
        // 2. Insert into form_bookings (requires migration 032 for payment_status / stripe_session_id)
        const [formResult] = await pool.query(`
            INSERT INTO form_bookings (
                booking_ref, service_class, event_type, hours, vehicle_type,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                passengers, flight_number, notes, reference_code,
                full_name, email, phone,
                total_amount, tax_amount, gratuity_amount, cc_fee_amount,
                raw_data,
                status, payment_status, stripe_session_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            bookingRef,
            bookingData.service_class,
            bookingData.event_type,
            parseInt(bookingData.hours) || null,
            bookingData.vehicle_type,
            bookingData.pickup_location,
            bookingData.dropoff_location,
            bookingData.pickup_date,
            bookingData.pickup_time,
            parseInt(bookingData.passengers) || 1,
            metadata.flightNumber,
            metadata.notes,
            metadata.referenceCode,
            bookingData.full_name,
            bookingData.email,
            bookingData.phone,
            price,
            metadata.breakdown?.taxes || 0,
            metadata.breakdown?.gratuity || 0,
            metadata.breakdown?.ccFee || 0,
            JSON.stringify(bookingData),
            bookingStatus,
            paymentStatus,
            null
        ]);

        // 3. Insert into the main reservations table so it shows up in dashboard
        const reservationNumber = `RES-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        const tripType = bookingData.service_class === 'hourly' ? 'hourly' : 'distance';
        
        // Find vehicle ID mapping (since vehicle_type is a slug from frontend but DB expects an ID)
        let vehicleTypeId = 1; // Default fallback
        if (bookingData.vehicle_type) {
            const [vRows] = await pool.query('SELECT id FROM vehicles WHERE slug = ?', [bookingData.vehicle_type]);
            if (vRows.length > 0) vehicleTypeId = vRows[0].id;
        }

        await pool.query(`
            INSERT INTO reservations (
                reservation_number, booking_type, trip_type,
                passenger_id, passenger_name, passenger_email, passenger_phone,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                vehicle_type_id, passenger_count,
                price, payment_status, reservation_status,
                form_booking_ref
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            reservationNumber,
            'form',
            tripType,
            passengerId,
            bookingData.full_name || 'Guest',
            bookingData.email,
            bookingData.phone || '',
            bookingData.pickup_location || 'Pending',
            bookingData.dropoff_location || 'Pending',
            bookingData.pickup_date || new Date().toISOString().split('T')[0],
            bookingData.pickup_time || '12:00',
            vehicleTypeId,
            parseInt(bookingData.passengers) || 1,
            price,
            paymentStatus,
            'pending',
            bookingRef
        ]);

        res.status(201).json({
            success: true,
            message: 'Booking submitted successfully',
            data: { id: formResult.insertId, bookingRef, reservationNumber }
        });
    } catch (error) {
        console.error('Error submitting booking:', error);
        res.status(500).json({ success: false, message: 'Failed to submit booking', error: error.message });
    }
};

/**
 * Called by Next.js after Stripe Checkout success (verify session server-side there first).
 * @route POST /api/forms/bookings/payment-confirm
 * @access Public (optional Bearer FORMS_PAYMENT_SECRET or BOOKINGS_API_SECRET)
 */
const confirmBookingPayment = async (req, res) => {
    try {
        const secret = process.env.FORMS_PAYMENT_SECRET || process.env.BOOKINGS_API_SECRET;
        if (secret) {
            const auth = req.headers.authorization;
            if (!auth || auth !== `Bearer ${secret}`) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
        }

        const { booking_ref, stripe_session_id, payment_status } = req.body || {};
        const ref = booking_ref && String(booking_ref).trim();
        if (!ref) {
            return res.status(400).json({ success: false, message: 'booking_ref is required' });
        }
        if (!stripe_session_id || String(stripe_session_id).length < 10) {
            return res.status(400).json({ success: false, message: 'stripe_session_id is required' });
        }

        const payStatus = normalizePaymentStatus(payment_status || 'paid');
        if (payStatus !== 'paid') {
            return res.status(400).json({ success: false, message: 'Only payment_status paid is supported for confirm' });
        }

        const [formUpdate] = await pool.query(
            `UPDATE form_bookings SET payment_status = ?, stripe_session_id = ?, updated_at = NOW() WHERE booking_ref = ?`,
            [payStatus, String(stripe_session_id).trim(), ref]
        );

        if (formUpdate.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'No form_bookings row found for this booking_ref'
            });
        }

        const [resUpdate] = await pool.query(
            `UPDATE reservations SET payment_status = ? WHERE form_booking_ref = ?`,
            [payStatus, ref]
        );

        return res.json({
            success: true,
            message: 'Payment recorded',
            data: {
                booking_ref: ref,
                payment_status: payStatus,
                form_bookings_updated: formUpdate.affectedRows,
                reservations_updated: resUpdate.affectedRows
            }
        });
    } catch (error) {
        console.error('confirmBookingPayment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message
        });
    }
};

/**
 * Get all form submissions from MySQL
 * @route GET /api/forms/bookings
 * @access Private
 */
const getBookings = async (req, res) => {
    try {
        const [bookings] = await pool.query('SELECT * FROM form_bookings ORDER BY created_at DESC');

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
        const [rows] = await pool.query('SELECT * FROM form_bookings WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const booking = rows[0];
        if (booking.raw_data && typeof booking.raw_data === 'string') {
            booking.raw_data = JSON.parse(booking.raw_data);
        }

        res.json({
            success: true,
            data: booking
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

/**
 * Admin: Create/Update Vehicle
 */
const upsertVehicle = async (req, res) => {
    try {
        const { id, slug, label, passenger_capacity, luggage_capacity, description, features, is_active, sort_order, pricing, service_classes } = req.body;
        
        let vehicleId = id;
        
        if (id) {
            // Update
            await pool.query(`
                UPDATE vehicles SET 
                    slug = ?, label = ?, passenger_capacity = ?, luggage_capacity = ?, 
                    description = ?, features = ?, is_active = ?, sort_order = ?
                WHERE id = ?
            `, [slug, label, passenger_capacity, luggage_capacity, description, JSON.stringify(features), is_active, sort_order, id]);
        } else {
            // Create
            const [result] = await pool.query(`
                INSERT INTO vehicles (slug, label, passenger_capacity, luggage_capacity, description, features, is_active, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [slug, label, passenger_capacity, luggage_capacity, description, JSON.stringify(features), is_active, sort_order]);
            vehicleId = result.insertId;
        }

        // Update Pricing
        if (pricing) {
            await pool.query(`
                INSERT INTO vehicle_pricing (vehicle_id, base_rate, per_mile, per_hour, per_minute)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    base_rate = VALUES(base_rate), per_mile = VALUES(per_mile), 
                    per_hour = VALUES(per_hour), per_minute = VALUES(per_minute)
            `, [vehicleId, pricing.base_rate, pricing.per_mile, pricing.per_hour, pricing.per_minute]);
        }

        // Update Service Classes
        if (service_classes) {
            await pool.query('DELETE FROM vehicle_service_classes WHERE vehicle_id = ?', [vehicleId]);
            if (service_classes.length > 0) {
                const values = service_classes.map(sc => [vehicleId, sc]);
                await pool.query('INSERT INTO vehicle_service_classes (vehicle_id, service_class) VALUES ?', [values]);
            }
        }

        res.json({ success: true, message: 'Vehicle saved successfully', vehicleId });
    } catch (error) {
        console.error('Error saving vehicle:', error);
        res.status(500).json({ success: false, message: 'Failed to save vehicle', error: error.message });
    }
};

/**
 * Admin: Update Rate Config
 */
const updateRateConfig = async (req, res) => {
    try {
        const { tax_rate, cc_fee_rate, gratuity_rate, service_multipliers, enabled_service_types } = req.body;
        
        await pool.query(`
            UPDATE form_rate_config SET 
                tax_rate = ?, cc_fee_rate = ?, gratuity_rate = ?, service_multipliers = ?, enabled_service_types = ?
            WHERE id = 1
        `, [tax_rate, cc_fee_rate, gratuity_rate, JSON.stringify(service_multipliers), JSON.stringify(enabled_service_types)]);

        res.json({ success: true, message: 'Rate config updated successfully' });
    } catch (error) {
        console.error('Error updating rate config:', error);
        res.status(500).json({ success: false, message: 'Failed to update rate config', error: error.message });
    }
};

/**
 * Admin: Delete Vehicle
 */
const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Use a transaction to ensure data integrity
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Check if trips table exists first
            const [tables] = await connection.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'trips'
            `);
            const tripsTableExists = tables[0].count > 0;

            // Check if vehicle has any active references (reservations or trips)
            let checkQuery = `SELECT (SELECT COUNT(*) FROM reservations WHERE vehicle_type_id = ?) as count`;
            let checkParams = [id];

            if (tripsTableExists) {
                checkQuery = `
                    SELECT 
                        (SELECT COUNT(*) FROM reservations WHERE vehicle_type_id = ?) +
                        (SELECT COUNT(*) FROM trips WHERE vehicle_id = ?) as count
                `;
                checkParams = [id, id];
            }

            const [activeRefs] = await connection.query(checkQuery, checkParams);

            if (activeRefs?.[0]?.count > 0) {
                // If referenced, perform a soft delete instead
                await connection.query('UPDATE vehicles SET is_active = FALSE WHERE id = ?', [id]);
                await connection.commit();
                return res.json({ 
                    success: true, 
                    message: 'Vehicle is linked to existing data. It has been deactivated instead of permanently deleted.' 
                });
            }

            // Otherwise, perform a hard delete (related tables will cascade delete via DB schema)
            const [result] = await connection.query('DELETE FROM vehicles WHERE id = ?', [id]);
            
            await connection.commit();
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Vehicle not found' });
            }
            
            res.json({ success: true, message: 'Vehicle deleted successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ success: false, message: 'Failed to delete vehicle', error: error.message });
    }
};

module.exports = {
    getBookings,
    getBookingById,
    getVehicles,
    getRateConfig,
    submitBooking,
    confirmBookingPayment,
    upsertVehicle,
    updateRateConfig,
    deleteVehicle
};
