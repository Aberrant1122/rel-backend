const { pool } = require('../config/database');

/**
 * Get all vehicles with pricing and service classes
 * @route GET /api/forms/vehicles
 * @access Public
 */
const getVehicles = async (req, res) => {
    try {
        const [vehicles] = await pool.query(`
            SELECT v.*, 
                   vp.base_rate, vp.per_mile, vp.per_hour, vp.per_minute,
                   GROUP_CONCAT(vsc.service_class) as service_classes
            FROM vehicles v
            LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
            LEFT JOIN vehicle_service_classes vsc ON v.id = vsc.vehicle_id
            WHERE v.is_active = TRUE
            GROUP BY v.id
            ORDER BY v.sort_order ASC
        `);

        // Format features and service_classes
        const formattedVehicles = vehicles.map(v => ({
            ...v,
            features: typeof v.features === 'string' ? JSON.parse(v.features) : v.features,
            service_classes: v.service_classes ? v.service_classes.split(',') : [],
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

/**
 * Submit a new booking to MySQL
 * @route POST /api/forms/bookings
 * @access Public
 */
const submitBooking = async (req, res) => {
    try {
        const bookingData = req.body;
        const bookingRef = `BR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const [result] = await pool.query(`
            INSERT INTO form_bookings (
                booking_ref, service_class, event_type, hours, vehicle_type,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                passengers, flight_number, notes, reference_code,
                full_name, email, phone,
                total_amount, tax_amount, gratuity_amount, cc_fee_amount,
                raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            bookingRef, 
            bookingData.serviceClass, 
            bookingData.eventType, 
            parseInt(bookingData.hours) || null,
            bookingData.vehicleType,
            bookingData.from,
            bookingData.to,
            bookingData.date,
            bookingData.time,
            parseInt(bookingData.passengers) || 1,
            bookingData.flightNumber,
            bookingData.notes,
            bookingData.referenceCode,
            bookingData.fullName,
            bookingData.email,
            bookingData.phone,
            bookingData.totalAmount || 0,
            bookingData.taxAmount || 0,
            bookingData.gratuityAmount || 0,
            bookingData.ccFeeAmount || 0,
            JSON.stringify(bookingData)
        ]);

        res.status(201).json({
            success: true,
            message: 'Booking submitted successfully',
            data: { id: result.insertId, bookingRef }
        });
    } catch (error) {
        console.error('Error submitting booking:', error);
        res.status(500).json({ success: false, message: 'Failed to submit booking', error: error.message });
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
        const { tax_rate, cc_fee_rate, gratuity_rate, service_multipliers } = req.body;
        
        await pool.query(`
            UPDATE form_rate_config SET 
                tax_rate = ?, cc_fee_rate = ?, gratuity_rate = ?, service_multipliers = ?
            WHERE id = 1
        `, [tax_rate, cc_fee_rate, gratuity_rate, JSON.stringify(service_multipliers)]);

        res.json({ success: true, message: 'Rate config updated successfully' });
    } catch (error) {
        console.error('Error updating rate config:', error);
        res.status(500).json({ success: false, message: 'Failed to update rate config', error: error.message });
    }
};

module.exports = {
    getBookings,
    getBookingById,
    getVehicles,
    getRateConfig,
    submitBooking,
    upsertVehicle,
    updateRateConfig
};
