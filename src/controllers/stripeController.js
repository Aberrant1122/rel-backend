const stripeService = require('../services/stripeService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../config/database');
const emailService = require('../services/emailService');

/**
 * Step 1: Create or Get Customer and return SetupIntent client_secret
 */
const initiateSetupIntent = async (req, res) => {
    try {
        const { email, name, phone } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Check if customer already exists in our DB or Stripe
        // For simplicity, we'll create a new one or the frontend can pass stripe_customer_id if known
        // In a real app, you'd lookup by email in your database first.

        // Let's check our users table for stripe_customer_id
        let stripeCustomerId;
        const [users] = await pool.query('SELECT id, stripe_customer_id FROM users WHERE email = ?', [email]);

        if (users.length > 0 && users[0].stripe_customer_id) {
            stripeCustomerId = users[0].stripe_customer_id;
        } else {
            const customer = await stripeService.createCustomer({ email, name, phone });
            stripeCustomerId = customer.id;

            // Update user in DB with stripe_customer_id if user exists
            if (users.length > 0) {
                await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [stripeCustomerId, users[0].id]);
            }
        }

        const setupIntent = await stripeService.createSetupIntent(stripeCustomerId);

        res.json({
            success: true,
            data: {
                customerId: stripeCustomerId,
                clientSecret: setupIntent.client_secret
            }
        });
    } catch (error) {
        console.error('initiateSetupIntent Error:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate setup intent', error: error.message });
    }
};

/**
 * Step 2: Save Payment Method after frontend confirms SetupIntent and charge immediately
 */
/**
 * Step 2: Save Payment Method after frontend confirms SetupIntent
 * Supports immediate or scheduled charging.
 */
const savePaymentMethod = async (req, res) => {
    try {
        const {
            bookingId,
            paymentMethodId,
            customerId,
            amount,
            scheduledChargeDate, // YYYY-MM-DD
            chargeLater = false
        } = req.body;

        if (!bookingId || !paymentMethodId || !customerId || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 1. Update form_bookings with Stripe IDs and initial status
        const initialStatus = (chargeLater || scheduledChargeDate) ? 'scheduled' : 'processing';

        const isNumeric = !isNaN(bookingId) && !isNaN(parseFloat(bookingId));
        const whereClause = isNumeric ? 'WHERE booking_ref = ? OR id = ?' : 'WHERE booking_ref = ?';
        const whereParams = isNumeric ? [bookingId, bookingId] : [bookingId];

        await pool.query(`
            UPDATE form_bookings 
            SET 
                stripe_customer_id = ?, 
                stripe_payment_method_id = ?,
                payment_status = ?,
                scheduled_charge_date = ?
            ${whereClause}
        `, [
            customerId,
            paymentMethodId,
            initialStatus,
            scheduledChargeDate || null,
            ...whereParams
        ]);

        // 2. Also update reservations table
        await pool.query(`
            UPDATE reservations 
            SET payment_status = ?
            WHERE form_booking_ref = ?
        `, [initialStatus, bookingId]);

        // If it's a scheduled charge, we're done for now
        if (chargeLater || scheduledChargeDate) {
            return res.json({
                success: true,
                message: 'Payment method saved and charge scheduled for ' + (scheduledChargeDate || 'the booking date')
            });
        }

        // 3. Otherwise, charge immediately
        try {
            const paymentIntent = await stripeService.chargeSavedCard({
                amount: amount,
                customerId: customerId,
                paymentMethodId: paymentMethodId,
                bookingId: bookingId
            });

            const finalStatus = paymentIntent.status === 'succeeded' ? 'paid' : 'failed';

            // Update with PaymentIntent ID and status
            const isNumeric = !isNaN(bookingId) && !isNaN(parseFloat(bookingId));
            const whereClause = isNumeric ? 'WHERE booking_ref = ? OR id = ?' : 'WHERE booking_ref = ?';
            const whereParams = isNumeric ? [bookingId, bookingId] : [bookingId];

            await pool.query(`
                UPDATE form_bookings 
                SET payment_intent_id = ?, payment_status = ?
                ${whereClause}
            `, [paymentIntent.id, finalStatus, ...whereParams]);

            await pool.query(`
                UPDATE reservations 
                SET payment_status = ?
                WHERE form_booking_ref = ?
            `, [finalStatus, bookingId]);

            if (paymentIntent.status === 'succeeded') {
                await sendInvoiceForBookingRef(bookingId);
                return res.json({
                    success: true,
                    message: 'Payment method saved and charged successfully',
                    paymentIntentId: paymentIntent.id
                });
            } else {
                return res.json({
                    success: false,
                    message: `Payment status: ${paymentIntent.status}`,
                    paymentIntentId: paymentIntent.id
                });
            }
        } catch (chargeError) {
            console.error('Immediate charge failed:', chargeError.message);

            const isNumeric = !isNaN(bookingId) && !isNaN(parseFloat(bookingId));
            const whereClause = isNumeric ? 'WHERE booking_ref = ? OR id = ?' : 'WHERE booking_ref = ?';
            const whereParams = isNumeric ? [bookingId, bookingId] : [bookingId];

            await pool.query(`
                UPDATE form_bookings SET payment_status = 'failed' 
                ${whereClause}
            `, [...whereParams]);

            await pool.query(`
                UPDATE reservations SET payment_status = 'failed' 
                WHERE form_booking_ref = ?
            `, [bookingId]);

            return res.status(500).json({
                success: false,
                message: 'Immediate payment failed',
                error: chargeError.message
            });
        }

    } catch (error) {
        console.error('savePaymentMethod Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Handle Stripe Webhook Events
 */
const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log(`💰 PaymentIntent was successful! ID: ${paymentIntent.id}`);
                await updatePaymentStatusByIntent(paymentIntent.id, 'paid');
                break;
            case 'payment_intent.payment_failed':
                const failedIntent = event.data.object;
                console.log(`❌ PaymentIntent failed! ID: ${failedIntent.id}`);
                await updatePaymentStatusByIntent(failedIntent.id, 'failed');
                break;
            // Handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Fetch reservation details and send invoice email for a given booking_ref
 */
const sendInvoiceForBookingRef = async (bookingRef) => {
    try {
        const [rows] = await pool.query(
            `SELECT fb.full_name, fb.email, fb.total_amount,
                    r.reservation_number, r.pickup_location, r.dropoff_location, r.pickup_date, r.pickup_time
             FROM form_bookings fb
             LEFT JOIN reservations r ON r.form_booking_ref = fb.booking_ref
             WHERE fb.booking_ref = ?`,
            [bookingRef]
        );
        if (rows.length > 0) {
            const b = rows[0];
            emailService.sendInvoiceEmail({
                reservation_number: b.reservation_number || bookingRef,
                passenger_name: b.full_name,
                passenger_email: b.email,
                pickup_date: b.pickup_date,
                pickup_time: b.pickup_time,
                pickup_location: b.pickup_location,
                dropoff_location: b.dropoff_location,
                price: b.total_amount
            }).catch(err => console.error('Non-blocking error sending invoice email:', err));
        }
    } catch (err) {
        console.error('sendInvoiceForBookingRef error:', err);
    }
};

/**
 * Helper to update payment status based on PaymentIntent ID
 */
const updatePaymentStatusByIntent = async (paymentIntentId, status) => {
    const [bookings] = await pool.query('SELECT booking_ref FROM form_bookings WHERE payment_intent_id = ?', [paymentIntentId]);

    if (bookings.length > 0) {
        const bookingRef = bookings[0].booking_ref;
        await pool.query('UPDATE form_bookings SET payment_status = ?, updated_at = NOW() WHERE booking_ref = ?', [status, bookingRef]);
        await pool.query('UPDATE reservations SET payment_status = ? WHERE form_booking_ref = ?', [status, bookingRef]);

        if (status === 'paid') {
            await sendInvoiceForBookingRef(bookingRef);
        }
    }
};

/**
 * Step 1 (Alternative): Create a Stripe Checkout Session in 'setup' mode
 * This is easier for frontend as it redirects to a Stripe-hosted page
 */
const createCheckoutSetupSession = async (req, res) => {
    try {
        const { email, name, bookingRef, successUrl, cancelUrl } = req.body;

        if (!email || !bookingRef) {
            return res.status(400).json({ success: false, message: 'Email and bookingRef are required' });
        }

        // Find or create customer
        let stripeCustomerId;
        const [users] = await pool.query('SELECT stripe_customer_id FROM users WHERE email = ?', [email]);

        if (users.length > 0 && users[0].stripe_customer_id) {
            stripeCustomerId = users[0].stripe_customer_id;
        } else {
            const customer = await stripeService.createCustomer({ email, name });
            stripeCustomerId = customer.id;
            if (users.length > 0) {
                await pool.query('UPDATE users SET stripe_customer_id = ? WHERE email = ?', [stripeCustomerId, email]);
            }
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'setup',
            customer: stripeCustomerId,
            client_reference_id: bookingRef,
            success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: {
                booking_ref: bookingRef
            }
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('createCheckoutSetupSession Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create setup session', error: error.message });
    }
};

/**
 * Endpoint to retrieve SetupIntent and return PaymentMethod ID
 */
const retrieveSetupIntent = async (req, res) => {
    try {
        const { id, session_id } = req.query;
        let setupIntentId = id;

        // If we got a checkout session ID, find the associated SetupIntent
        if (session_id && session_id.startsWith('cs_')) {
            const session = await stripe.checkout.sessions.retrieve(session_id);
            setupIntentId = session.setup_intent;
        }

        if (!setupIntentId) return res.status(400).json({ success: false, message: 'SetupIntent ID or Session ID is required' });

        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

        if (setupIntent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: `SetupIntent status is ${setupIntent.status}`
            });
        }

        res.json({
            success: true,
            paymentMethodId: setupIntent.payment_method,
            customerId: setupIntent.customer
        });
    } catch (error) {
        console.error('retrieveSetupIntent Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve setup intent', error: error.message });
    }
};
/**
 * Manual Admin Retry: Charge a saved card immediately
 */
const retryCharge = async (req, res) => {
    try {
        const { bookingId } = req.body;
        if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID is required' });

        // 1. Fetch booking details
        const isNumeric = !isNaN(bookingId) && !isNaN(parseFloat(bookingId));
        const whereClause = isNumeric ? 'WHERE booking_ref = ? OR id = ?' : 'WHERE booking_ref = ?';
        const whereParams = isNumeric ? [bookingId, bookingId] : [bookingId];

        const [bookings] = await pool.query(`
            SELECT id, booking_ref, total_amount, stripe_customer_id, stripe_payment_method_id, charge_retry_count
            FROM form_bookings
            ${whereClause}
        `, whereParams);

        if (bookings.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
        const booking = bookings[0];

        if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
            return res.status(400).json({ success: false, message: 'No saved payment method found for this booking' });
        }

        // 2. Attempt immediate charge
        const paymentIntent = await stripeService.chargeSavedCard({
            amount: booking.total_amount,
            customerId: booking.stripe_customer_id,
            paymentMethodId: booking.stripe_payment_method_id,
            bookingId: booking.booking_ref,
            idempotencyKey: `manual_retry_${booking.booking_ref}_${Date.now()}`
        });

        // 3. Update database
        const status = paymentIntent.status === 'succeeded' ? 'paid' : 'failed';

        await pool.query('UPDATE form_bookings SET payment_status = ?, payment_intent_id = ? WHERE id = ?', [status, paymentIntent.id, booking.id]);
        await pool.query('UPDATE reservations SET payment_status = ? WHERE form_booking_ref = ?', [status, booking.booking_ref]);

        if (paymentIntent.status === 'succeeded') {
            await sendInvoiceForBookingRef(booking.booking_ref);
            res.json({ success: true, message: 'Payment successful', paymentIntentId: paymentIntent.id });
        } else {
            res.json({ success: false, message: `Payment ${paymentIntent.status}`, paymentIntentId: paymentIntent.id });
        }

    } catch (error) {
        console.error('retryCharge Error:', error.message);
        res.status(500).json({ success: false, message: 'Payment attempt failed', error: error.message });
    }
};

module.exports = {
    initiateSetupIntent,
    savePaymentMethod,
    handleWebhook,
    createCheckoutSetupSession,
    retrieveSetupIntent,
    retryCharge
};
