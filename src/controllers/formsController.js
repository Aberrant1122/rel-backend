const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const notificationsService = require('../services/notificationsService');
const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());

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
        
        // Allow getting inactive vehicles via query param (for admin editing)
        const includeInactive = req.query.include_inactive === 'true';
        const whereClause = includeInactive ? '' : 'WHERE v.is_active = TRUE';
        
        const [vehicles] = await pool.query(`
            SELECT v.*,
                   vp.base_rate, vp.per_mile, vp.per_hour, vp.per_minute,
                   vp.distance_tiers, vp.hourly_tiers,
                   GROUP_CONCAT(vsc.service_class) as service_classes
            FROM vehicles v
            LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
            LEFT JOIN vehicle_service_classes vsc ON v.id = vsc.vehicle_id
            ${whereClause}
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
            per_minute: v.per_minute !== null ? parseFloat(v.per_minute) : null,
            distance_tiers: typeof v.distance_tiers === 'string' ? JSON.parse(v.distance_tiers) : (v.distance_tiers || null),
            hourly_tiers: typeof v.hourly_tiers === 'string' ? JSON.parse(v.hourly_tiers) : (v.hourly_tiers || null)
        }));

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
/**
 * After payment confirm, try to save the payment method for future charges.
 * Tries multiple approaches: direct params → session → payment_intent_id → Stripe customer sync
 */
const savePaymentMethodAfterConfirm = async (bookingRef, stripeSessionId, paymentIntentId, stripeCustomerIdFromReq, stripePaymentMethodIdFromReq) => {
    try {
        let paymentMethodId = stripePaymentMethodIdFromReq || null;
        let stripeCustomerId = stripeCustomerIdFromReq || null;

        // Approach 0: Use payment info passed directly from the form (most reliable)
        // This avoids cross-account key issues if the form and backend use different Stripe accounts
        if (paymentMethodId && stripeCustomerId) {
            const [bookingRows] = await pool.query('SELECT email FROM form_bookings WHERE booking_ref = ?', [bookingRef]);
            if (bookingRows.length > 0) {
                const email = bookingRows[0].email;
                const [users] = await pool.query('SELECT id, stripe_customer_id FROM users WHERE email = ?', [email]);
                if (users.length > 0) {
                    const user = users[0];
                    if (!user.stripe_customer_id) {
                        await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, user.id]);
                    }
                    await insertPaymentMethod(user.id, stripeCustomerId, paymentMethodId);
                    console.log(`Saved payment method ${paymentMethodId} for user ${user.id} via direct params`);
                    return;
                }
            }
        }

        // Approach 1: Try via Stripe Checkout session (works when same Stripe account)
        if (!paymentMethodId && stripeSessionId && stripeSessionId.startsWith('cs_')) {
            try {
                const session = await stripe.checkout.sessions.retrieve(String(stripeSessionId).trim());
                if (session.payment_intent) {
                    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                    paymentMethodId = paymentIntent.payment_method;
                    stripeCustomerId = paymentIntent.customer;
                }
        } catch (sessionErr) {
            console.error('savePaymentMethodAfterConfirm - Session lookup failed:', sessionErr);
        }
        }

        // Approach 2: Try via payment_intent_id on form_booking
        if (!paymentMethodId) {
            const effectivePiId = paymentIntentId || null;
            if (!effectivePiId) {
                try {
                    const [bookings] = await pool.query(
                        'SELECT payment_intent_id FROM form_bookings WHERE booking_ref = ? AND payment_intent_id IS NOT NULL',
                        [bookingRef]
                    );
                    if (bookings.length > 0 && bookings[0].payment_intent_id) {
                        const paymentIntent = await stripe.paymentIntents.retrieve(bookings[0].payment_intent_id);
                        paymentMethodId = paymentIntent.payment_method;
                        stripeCustomerId = paymentIntent.customer;
                    }
                } catch (piErr) {
                    console.log('PaymentIntent lookup failed:', piErr.message);
                }
            } else {
                try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(effectivePiId);
                    paymentMethodId = paymentIntent.payment_method;
                    stripeCustomerId = paymentIntent.customer;
                } catch (piErr) {
                    console.log('PaymentIntent lookup failed:', piErr.message);
                }
            }
        }

        // Get the user info
        const [bookingRows] = await pool.query('SELECT email FROM form_bookings WHERE booking_ref = ?', [bookingRef]);
        if (bookingRows.length === 0) return;

        const email = bookingRows[0].email;
        const [users] = await pool.query('SELECT id, stripe_customer_id FROM users WHERE email = ?', [email]);
        if (users.length === 0) return;

        const user = users[0];

        // If we got a Stripe customer from the PaymentIntent but user doesn't have one saved
        if (stripeCustomerId && !user.stripe_customer_id) {
            await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, user.id]);
        } else if (!stripeCustomerId) {
            stripeCustomerId = user.stripe_customer_id;
        }

        // Approach 3: We have a specific PM to save
        if (paymentMethodId && stripeCustomerId) {
            await insertPaymentMethod(user.id, stripeCustomerId, paymentMethodId);
            console.log(`Saved payment method ${paymentMethodId} for user ${user.id} via session/PI`);
            return;
        }

        // Approach 4: No specific PM, but user has stripe_customer_id → sync all from Stripe
        if (stripeCustomerId) {
            try {
                const pmList = await stripe.paymentMethods.list({
                    customer: stripeCustomerId,
                    type: 'card',
                });
                for (const pm of pmList.data) {
                    await insertPaymentMethod(user.id, stripeCustomerId, pm.id);
                }
                if (pmList.data.length > 0) {
                    console.log(`Synced ${pmList.data.length} payment methods from Stripe for user ${user.id}`);
                }
            } catch (syncErr) {
                console.error('Stripe sync fallback failed:', syncErr.message);
            }
        }
    } catch (error) {
        console.error('savePaymentMethodAfterConfirm error:', error.message);
    }
};

/**
 * Insert a payment method record if not already saved
 */
const insertPaymentMethod = async (userId, stripeCustomerId, paymentMethodId) => {
    const [existing] = await pool.query(
        'SELECT id FROM customer_payment_methods WHERE stripe_payment_method_id = ?',
        [paymentMethodId]
    );
    if (existing.length > 0) return existing[0];

    let pm;
    try {
        pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (pmErr) {
        pm = null;
    }

    // Check if the same physical card (by brand + last4 + user) is already saved
    if (pm?.card?.brand && pm?.card?.last4) {
        const [existingCard] = await pool.query(
            `SELECT id, stripe_payment_method_id FROM customer_payment_methods 
             WHERE user_id = ? AND card_brand = ? AND card_last4 = ?`,
            [userId, pm.card.brand, pm.card.last4]
        );
        if (existingCard.length > 0) {
            await pool.query(
                `UPDATE customer_payment_methods 
                 SET stripe_payment_method_id = ?, stripe_customer_id = ?, 
                     card_exp_month = ?, card_exp_year = ?
                 WHERE id = ?`,
                [
                    paymentMethodId,
                    stripeCustomerId,
                    pm.card.exp_month?.toString() || null,
                    pm.card.exp_year?.toString() || null,
                    existingCard[0].id
                ]
            );
            return existingCard[0];
        }
    }

    // Attach the PaymentMethod to the Customer for future off-session reuse
    try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
    } catch (attachErr) {
        // "already attached" errors are safe to ignore
        if (!attachErr.message?.includes('already')) {
            console.error('Failed to attach payment method to customer:', attachErr.message);
        }
    }

    const [count] = await pool.query(
        'SELECT COUNT(*) as cnt FROM customer_payment_methods WHERE user_id = ?',
        [userId]
    );

    await pool.query(`
        INSERT INTO customer_payment_methods 
        (user_id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        userId,
        stripeCustomerId,
        paymentMethodId,
        pm?.card?.brand || null,
        pm?.card?.last4 || null,
        pm?.card?.exp_month?.toString() || null,
        pm?.card?.exp_year?.toString() || null,
        count[0].cnt === 0
    ]);

    return { id: 0 };
};

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
                status, payment_status, stripe_session_id, passenger_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            null,
            passengerId
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

        const [reservationResult] = await pool.query(`
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

        const reservationId = reservationResult.insertId;
        const notificationMessage = `Reservation #${reservationNumber} for ${bookingData.full_name || 'Guest'} is ready for dispatch.`;
        try {
            const [dispatchers] = await pool.query(
                'SELECT id FROM users WHERE role = ? AND is_active = 1',
                ['dispatcher']
            );
            for (const dispatcher of dispatchers) {
                await notificationsService.createNotification(
                    dispatcher.id,
                    'new_reservation',
                    'Reservation Received',
                    notificationMessage,
                    reservationId,
                    'reservation'
                );
            }
        } catch (notifError) {
            console.error('Failed to notify dispatchers about new form reservation:', notifError);
        }

        // Send booking confirmation email (non-blocking)
        emailService.sendBookingConfirmationEmail({
            reservation_number: reservationNumber,
            passenger_name: bookingData.full_name || 'Valued Customer',
            passenger_email: bookingData.email,
            pickup_date: bookingData.pickup_date,
            pickup_time: bookingData.pickup_time,
            pickup_location: bookingData.pickup_location,
            dropoff_location: bookingData.dropoff_location,
            price
        }).catch(err => {
            console.error('Non-blocking error sending booking confirmation email:', err);
        });

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

        const {
            booking_ref,
            stripe_session_id,
            payment_status,
            payment_intent_id,
            stripe_customer_id,
            stripe_payment_method_id
        } = req.body || {};

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

        const piId = payment_intent_id ? String(payment_intent_id).trim() : null;
        const custId = stripe_customer_id ? String(stripe_customer_id).trim() : null;

        // Skip if already processed (prevents duplicate processing from replaying thank-you URL)
        const [existingBooking] = await pool.query(
            'SELECT payment_status FROM form_bookings WHERE booking_ref = ?',
            [ref]
        );
        if (existingBooking.length > 0 && existingBooking[0].payment_status === 'paid') {
            return res.json({
                success: true,
                message: 'Payment already confirmed',
                data: { booking_ref: ref, payment_status: 'paid', already_processed: true }
            });
        }

        const [formUpdate] = await pool.query(
            `UPDATE form_bookings SET payment_status = ?, stripe_session_id = ?, payment_intent_id = ?, stripe_customer_id = ?, updated_at = NOW() WHERE booking_ref = ?`,
            [payStatus, String(stripe_session_id).trim(), piId, custId, ref]
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

        // Send invoice email for paid booking (non-blocking)
        const [bookingRow] = await pool.query(
            `SELECT fb.*, r.reservation_number, r.pickup_location, r.dropoff_location, r.pickup_date, r.pickup_time
             FROM form_bookings fb
             LEFT JOIN reservations r ON r.form_booking_ref = fb.booking_ref
             WHERE fb.booking_ref = ?`,
            [ref]
        );
        if (bookingRow.length > 0) {
            const b = bookingRow[0];
            emailService.sendInvoiceEmail({
                reservation_number: b.reservation_number || b.booking_ref,
                passenger_name: b.full_name,
                passenger_email: b.email,
                pickup_date: b.pickup_date,
                pickup_time: b.pickup_time,
                pickup_location: b.pickup_location,
                dropoff_location: b.dropoff_location,
                price: b.total_amount
            }).catch(err => {
                console.error('Non-blocking error sending invoice email:', err);
            });
        }

        // Auto-save the payment method for future charges
        await savePaymentMethodAfterConfirm(ref, stripe_session_id, piId, custId, stripe_payment_method_id ? String(stripe_payment_method_id).trim() : null);

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
        const { id, slug, label, passenger_capacity, luggage_capacity, description, features, is_active, sort_order, pricing, service_classes, distance_tiers, hourly_tiers } = req.body;
        
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

        // Update Pricing - handle both nested (pricing.distance_tiers) and top-level (distance_tiers) tiers
        const baseRate = pricing?.base_rate ?? req.body.base_rate ?? 0;
        const perMile = pricing?.per_mile ?? req.body.per_mile ?? 0;
        const perHour = pricing?.per_hour ?? req.body.per_hour ?? 0;
        const perMinute = pricing?.per_minute ?? req.body.per_minute ?? 0;
        
        // Accept tiers from pricing object or directly from request body
        const distTiers = pricing?.distance_tiers ?? distance_tiers;
        const hrlyTiers = pricing?.hourly_tiers ?? hourly_tiers;

        // Ensure tiers are stored as JSON or null (not undefined or empty string)
        const distTiersJson = (distTiers !== undefined && distTiers !== null) ? JSON.stringify(distTiers) : null;
        const hrlyTiersJson = (hrlyTiers !== undefined && hrlyTiers !== null) ? JSON.stringify(hrlyTiers) : null;

        await pool.query(`
            INSERT INTO vehicle_pricing (vehicle_id, base_rate, per_mile, per_hour, per_minute, distance_tiers, hourly_tiers)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                base_rate = VALUES(base_rate), per_mile = VALUES(per_mile),
                per_hour = VALUES(per_hour), per_minute = VALUES(per_minute),
                distance_tiers = VALUES(distance_tiers), hourly_tiers = VALUES(hourly_tiers)
        `, [
            vehicleId,
            baseRate, perMile, perHour, perMinute,
            distTiersJson,
            hrlyTiersJson
        ]);

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
