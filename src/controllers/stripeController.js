const stripeService = require('../services/stripeService');
const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());
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
            (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
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
 * Look up form_booking_ref from a reservation ID
 */
const getBookingRefFromReservation = async (reservationId) => {
    try {
        const [rows] = await pool.query('SELECT form_booking_ref FROM reservations WHERE id = ?', [reservationId]);
        return rows.length > 0 ? rows[0].form_booking_ref : null;
    } catch (err) {
        console.error('getBookingRefFromReservation error:', err);
        return null;
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
        
        let errorMessage = error.message;
        if (error.raw?.code === 'resource_missing' && error.message.includes('No such PaymentMethod')) {
            try {
                const isNumeric = !isNaN(bookingId) && !isNaN(parseFloat(bookingId));
                const whereClause = isNumeric ? 'WHERE booking_ref = ? OR id = ?' : 'WHERE booking_ref = ?';
                const whereParams = isNumeric ? [bookingId, bookingId] : [bookingId];
                await pool.query(`UPDATE form_bookings SET stripe_payment_method_id = NULL, stripe_customer_id = NULL WHERE ${whereClause}`, whereParams);
                console.log(`Cleared stale payment method for booking ${bookingId}`);
            } catch (delErr) {
                console.error('Failed to clear stale payment method:', delErr.message);
            }
            errorMessage = 'This booking has a saved card that no longer exists on your Stripe account. The card reference has been cleared.';
        }

        res.status(500).json({ success: false, message: 'Payment attempt failed', error: errorMessage });
    }
};

/**
 * Save a payment method to our customer_payment_methods table
 * Called after successful checkout to store card for future charges
 */
const savePaymentMethodForCustomer = async (req, res) => {
    try {
        const { userId, stripeCustomerId, paymentMethodId } = req.body;

        if (!userId || !stripeCustomerId || !paymentMethodId) {
            return res.status(400).json({ success: false, message: 'userId, stripeCustomerId, and paymentMethodId are required' });
        }

        // Retrieve the payment method from Stripe to get card details
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

        // Attach the PaymentMethod to the Customer for future off-session reuse
        try {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
        } catch (attachErr) {
            if (!attachErr.message?.includes('already')) {
                console.error('Failed to attach payment method to customer:', attachErr.message);
            }
        }

        const cardBrand = pm.card?.brand || null;
        const cardLast4 = pm.card?.last4 || null;
        const cardExpMonth = pm.card?.exp_month?.toString() || null;
        const cardExpYear = pm.card?.exp_year?.toString() || null;

        // Check if this payment method is already saved
        const [existing] = await pool.query(
            'SELECT id FROM customer_payment_methods WHERE stripe_payment_method_id = ?',
            [paymentMethodId]
        );

        if (existing.length > 0) {
            return res.json({ success: true, message: 'Payment method already saved', data: existing[0] });
        }

        // Check if this is the first payment method for this user (make it default)
        const [count] = await pool.query(
            'SELECT COUNT(*) as cnt FROM customer_payment_methods WHERE user_id = ?',
            [userId]
        );
        const isDefault = count[0].cnt === 0;

        const [result] = await pool.query(`
            INSERT INTO customer_payment_methods 
            (user_id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, stripeCustomerId, paymentMethodId, cardBrand, cardLast4, cardExpMonth, cardExpYear, isDefault]);

        res.json({
            success: true,
            message: 'Payment method saved',
            data: { id: result.insertId, card_brand: cardBrand, card_last4: cardLast4 }
        });
    } catch (error) {
        console.error('savePaymentMethodForCustomer Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save payment method', error: error.message });
    }
};

/**
 * Get all saved payment methods for a customer (by user ID)
 * Syncs from Stripe if local DB is empty but customer has a Stripe customer ID.
 * GET /api/stripe/customers/:userId/payment-methods
 */
const getCustomerPaymentMethods = async (req, res) => {
    try {
        const { userId } = req.params;

        // First check local DB
        let [methods] = await pool.query(`
            SELECT id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, 
                   card_exp_month, card_exp_year, is_default, created_at
            FROM customer_payment_methods 
            WHERE user_id = ?
            ORDER BY is_default DESC, created_at DESC
        `, [userId]);

        // If we have local methods, return them
        if (methods.length > 0) {
            return res.json({ success: true, data: methods });
        }

        // No local methods — try to sync from Stripe
        const [users] = await pool.query('SELECT id, stripe_customer_id FROM users WHERE id = ?', [userId]);
        if (users.length === 0 || !users[0].stripe_customer_id) {
            return res.json({ success: true, data: [] });
        }

        const stripeCustomerId = users[0].stripe_customer_id;

        try {
            const pmList = await stripe.paymentMethods.list({
                customer: stripeCustomerId,
                type: 'card',
            });

            if (pmList.data.length === 0) {
                return res.json({ success: true, data: [] });
            }

            // Save each card to our DB
            const savedMethods = [];
            for (const pm of pmList.data) {
                const cardBrand = pm.card?.brand || null;
                const cardLast4 = pm.card?.last4 || null;
                const cardExpMonth = pm.card?.exp_month?.toString() || null;
                const cardExpYear = pm.card?.exp_year?.toString() || null;

                // Check if already saved (race condition guard)
                const [existing] = await pool.query(
                    'SELECT id FROM customer_payment_methods WHERE stripe_payment_method_id = ?',
                    [pm.id]
                );

                if (existing.length > 0) {
                    savedMethods.push(existing[0]);
                    continue;
                }

                const [count] = await pool.query(
                    'SELECT COUNT(*) as cnt FROM customer_payment_methods WHERE user_id = ?',
                    [userId]
                );
                const isDefault = savedMethods.length === 0 && count[0].cnt === 0;

                const [result] = await pool.query(`
                    INSERT INTO customer_payment_methods 
                    (user_id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [userId, stripeCustomerId, pm.id, cardBrand, cardLast4, cardExpMonth, cardExpYear, isDefault]);

                savedMethods.push({
                    id: result.insertId,
                    stripe_customer_id: stripeCustomerId,
                    stripe_payment_method_id: pm.id,
                    card_brand: cardBrand,
                    card_last4: cardLast4,
                    card_exp_month: cardExpMonth,
                    card_exp_year: cardExpYear,
                    is_default: isDefault,
                    created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                });
            }

            res.json({ success: true, data: savedMethods, synced: true });
        } catch (stripeError) {
            console.error('Stripe sync error:', stripeError.message);
            res.json({ success: true, data: [] });
        }
    } catch (error) {
        console.error('getCustomerPaymentMethods Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve payment methods', error: error.message });
    }
};

/**
 * Delete a saved payment method
 * DELETE /api/stripe/payment-methods/:pmId
 */
const deleteCustomerPaymentMethod = async (req, res) => {
    try {
        const { pmId } = req.params;

        const [method] = await pool.query('SELECT * FROM customer_payment_methods WHERE id = ?', [pmId]);
        if (method.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment method not found' });
        }

        // Detach from Stripe
        try {
            await stripe.paymentMethods.detach(method[0].stripe_payment_method_id);
        } catch (stripeError) {
            console.error('Stripe detach error (non-blocking):', stripeError.message);
        }

        await pool.query('DELETE FROM customer_payment_methods WHERE id = ?', [pmId]);

        res.json({ success: true, message: 'Payment method removed' });
    } catch (error) {
        console.error('deleteCustomerPaymentMethod Error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete payment method', error: error.message });
    }
};

/**
 * Charge a customer from the dashboard using a saved payment method
 * Accepts either local paymentMethodId (from our DB) OR stripePaymentMethodId + stripeCustomerId (direct Stripe PM)
 * Also accepts reservationId and formBookingRef to update linked reservation status
 * POST /api/stripe/charge-customer
 */
const chargeCustomerFromDashboard = async (req, res) => {
    try {
        const { userId, paymentMethodId, stripePaymentMethodId, stripeCustomerId, amount, description, reservationId, formBookingRef } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ success: false, message: 'userId and amount are required' });
        }

        if (!paymentMethodId && !stripePaymentMethodId) {
            return res.status(400).json({ success: false, message: 'paymentMethodId or stripePaymentMethodId is required' });
        }

        let chargeCustomerId, chargePaymentMethodId;

        if (paymentMethodId) {
            const [methods] = await pool.query('SELECT * FROM customer_payment_methods WHERE id = ? AND user_id = ?', [paymentMethodId, userId]);
            if (methods.length === 0) {
                return res.status(404).json({ success: false, message: 'Saved payment method not found' });
            }
            chargeCustomerId = methods[0].stripe_customer_id;
            chargePaymentMethodId = methods[0].stripe_payment_method_id;
        } else {
            chargeCustomerId = stripeCustomerId;
            chargePaymentMethodId = stripePaymentMethodId;
        }

        if (!chargeCustomerId || !chargePaymentMethodId) {
            return res.status(400).json({ success: false, message: 'Could not resolve Stripe customer and payment method' });
        }

        const [users] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = users[0];

        const bookingId = formBookingRef || `dashboard_${userId}_${Date.now()}`;

        const paymentIntent = await stripeService.chargeSavedCard({
            amount: amount,
            customerId: chargeCustomerId,
            paymentMethodId: chargePaymentMethodId,
            bookingId: bookingId,
            idempotencyKey: `dashboard_charge_${userId}_${Date.now()}`
        });

        const status = paymentIntent.status === 'succeeded' ? 'succeeded' : 'failed';

        // Record the charge in customer_charges table
        await pool.query(`
            INSERT INTO customer_charges 
            (user_id, amount, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, amount, paymentIntent.id, chargeCustomerId, chargePaymentMethodId, status, description || null]);

        // Update linked reservation payment status if charge succeeded
        if (paymentIntent.status === 'succeeded') {
            if (reservationId) {
                await pool.query(
                    'UPDATE reservations SET payment_status = ?, updated_at = NOW() WHERE id = ?',
                    ['paid', reservationId]
                );
            }
            if (formBookingRef) {
                await pool.query(
                    'UPDATE form_bookings SET payment_status = ?, payment_intent_id = ?, updated_at = NOW() WHERE booking_ref = ?',
                    ['paid', paymentIntent.id, formBookingRef]
                );
            }

            // Send invoice email for the completed charge
            const invoiceRef = formBookingRef || (reservationId ? await getBookingRefFromReservation(reservationId) : null);
            if (invoiceRef) {
                await sendInvoiceForBookingRef(invoiceRef).catch(err =>
                    console.error('Non-blocking error sending invoice email for dashboard charge:', err)
                );
            } else {
                // No linked booking — send a receipt using user info from the database
                try {
                    const [userRows] = await pool.query(
                        'SELECT name, email FROM users WHERE id = ?', [userId]
                    );
                    if (userRows.length > 0 && userRows[0].email) {
                        await emailService.sendInvoiceEmail({
                            reservation_number: `CHG-${Date.now().toString().slice(-6)}`,
                            passenger_name: userRows[0].name || 'Valued Customer',
                            passenger_email: userRows[0].email,
                            pickup_date: new Date().toLocaleDateString(),
                            pickup_time: new Date().toLocaleTimeString(),
                            description: description || 'Dashboard charge',
                            price: amount
                        }).catch(err => console.error('Non-blocking error sending receipt email:', err));
                    }
                } catch (userErr) {
                    console.error('Failed to send receipt email for dashboard charge:', userErr);
                }
            }

            res.json({
                success: true,
                message: 'Payment successful',
                data: {
                    paymentIntentId: paymentIntent.id,
                    amount: amount,
                    status: 'succeeded'
                }
            });
        } else {
            res.json({
                success: false,
                message: `Payment ${paymentIntent.status}`,
                data: {
                    paymentIntentId: paymentIntent.id,
                    status: paymentIntent.status
                }
            });
        }
    } catch (error) {
        console.error('chargeCustomerFromDashboard Error:', error);

        if (req.body.userId && req.body.amount) {
            try {
                await pool.query(`
                    INSERT INTO customer_charges 
                    (user_id, amount, stripe_customer_id, stripe_payment_method_id, status, description)
                    VALUES (?, ?, ?, ?, 'failed', ?)
                `, [req.body.userId, req.body.amount, null, null, error.message]);
            } catch (logErr) {
                console.error('Failed to log charge attempt:', logErr.message);
            }
        }

        let errorMessage = error.message;
        if (error.raw?.code === 'resource_missing' && error.message.includes('No such PaymentMethod')) {
            // Auto-remove stale payment method from local DB
            const pmId = req.body.paymentMethodId;
            if (pmId) {
                try {
                    await pool.query('DELETE FROM customer_payment_methods WHERE id = ?', [pmId]);
                    console.log(`Removed stale payment method id=${pmId} from customer_payment_methods`);
                } catch (delErr) {
                    console.error('Failed to remove stale payment method:', delErr.message);
                }
            }
            errorMessage = 'This saved card no longer exists on your Stripe account. It has been removed. Ask the customer to make a new booking to re-save their card.';
        } else if (error.message?.includes('previously used with a PaymentIntent without Customer attachment')) {
            // PM was saved but never attached to the customer — auto-remove
            const pmId = req.body.paymentMethodId;
            if (pmId) {
                try {
                    await pool.query('DELETE FROM customer_payment_methods WHERE id = ?', [pmId]);
                    console.log(`Removed unattached payment method id=${pmId} from customer_payment_methods`);
                } catch (delErr) {
                    console.error('Failed to remove unattached payment method:', delErr.message);
                }
            }
            errorMessage = 'This saved card was not properly attached and cannot be reused. The card reference has been removed. Ask the customer to make a new booking to re-save their card properly.';
        }

        res.status(500).json({ success: false, message: 'Payment failed', error: errorMessage });
    }
};

/**
 * Get charge history for a customer
 * GET /api/stripe/customers/:userId/charges
 */
const getCustomerCharges = async (req, res) => {
    try {
        const { userId } = req.params;

        const [charges] = await pool.query(`
            SELECT id, amount, stripe_payment_intent_id, status, description, created_at
            FROM customer_charges
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        res.json({ success: true, data: charges });
    } catch (error) {
        console.error('getCustomerCharges Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve charges', error: error.message });
    }
};

module.exports = {
    initiateSetupIntent,
    savePaymentMethod,
    handleWebhook,
    createCheckoutSetupSession,
    retrieveSetupIntent,
    retryCharge,
    savePaymentMethodForCustomer,
    getCustomerPaymentMethods,
    deleteCustomerPaymentMethod,
    chargeCustomerFromDashboard,
    getCustomerCharges
};
