const cron = require('node-cron');
const { pool } = require('../config/database');
const stripeService = require('../services/stripeService');
const notificationsService = require('../services/notificationsService');

/**
 * Scheduled job to run every day at midnight (00:00)
 * to process bookings that are due for payment.
 */
const startChargeScheduler = () => {
    // Run every day at midnight US Eastern Time (New York)
    cron.schedule('0 0 * * *', async () => {
        console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}] 🕒 Starting daily scheduled charge processing (US/Eastern)...`);
        try {
            await processEligiblePayments();
            console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}] ✅ Daily charge processing completed.`);
        } catch (error) {
            console.error(`[${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}] ❌ Fatal error in scheduler:`, error.message);
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });

    console.log('⏰ Charge Scheduler initialized to run at 00:00 daily (US/Eastern Time).');
};

/**
 * Find and process bookings with scheduled_charge_date <= today
 */
const processEligiblePayments = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Find bookings that are:
    // 1. Scheduled or previously failed
    // 2. Charge date is today or in the past
    // 3. Have Stripe details
    // 4. Have less than 3 retry attempts
    const [bookings] = await pool.query(`
        SELECT id, booking_ref, total_amount, stripe_customer_id, stripe_payment_method_id, charge_retry_count
        FROM form_bookings
        WHERE payment_status IN ('scheduled', 'failed')
          AND scheduled_charge_date <= ?
          AND stripe_customer_id IS NOT NULL
          AND stripe_payment_method_id IS NOT NULL
          AND charge_retry_count < 3
    `, [today]);

    console.log(`🔍 Found ${bookings.length} eligible bookings due for payment on ${today}.`);

    for (const booking of bookings) {
        try {
            await processSinglePayment(booking);
        } catch (error) {
            console.error(`Error processing booking ${booking.booking_ref}:`, error.message);
        }
    }
};

/**
 * Process a single charge with off-session PaymentIntent
 */
const processSinglePayment = async (booking) => {
    console.log(`💳 Attempting charge for booking ${booking.booking_ref} (Retry: ${booking.charge_retry_count})...`);

    try {
        // Atomic Lock: Only proceed if we can successfully change status from 'scheduled'/'failed' to 'processing'
        const [lockResult] = await pool.query(
            'UPDATE form_bookings SET payment_status = "processing" WHERE id = ? AND payment_status IN ("scheduled", "failed")',
            [booking.id]
        );

        if (lockResult.affectedRows === 0) {
            console.log(`⏩ Skipping booking ${booking.booking_ref} - already being processed.`);
            return;
        }

        const paymentIntent = await stripeService.chargeSavedCard({
            amount: booking.total_amount,
            customerId: booking.stripe_customer_id,
            paymentMethodId: booking.stripe_payment_method_id,
            bookingId: booking.booking_ref,
            idempotencyKey: `charge_${booking.booking_ref}_retry_${booking.charge_retry_count}`
        });

        // Update database with intent ID
        await pool.query('UPDATE form_bookings SET payment_intent_id = ? WHERE id = ?', [paymentIntent.id, booking.id]);

        if (paymentIntent.status === 'succeeded') {
            console.log(`✅ Payment successful for ${booking.booking_ref}: ${paymentIntent.id}`);
            await updateBookingStatus(booking.booking_ref, 'paid');
        } else {
            console.warn(`⚠️ Payment ${paymentIntent.id} status: ${paymentIntent.status}`);
            // If it requires action (like 3DS), it will likely fail for off-session.
            // Webhook will also handle final state usually, but we handle it here for immediate feedback.
        }

    } catch (error) {
        const newRetryCount = booking.charge_retry_count + 1;
        console.error(`❌ Payment failed for ${booking.booking_ref}:`, error.message);

        await pool.query(`
            UPDATE form_bookings 
            SET 
                payment_status = 'failed', 
                charge_retry_count = ?
            WHERE id = ?
        `, [newRetryCount, booking.id]);

        await updateBookingStatus(booking.booking_ref, 'failed');

        // Notify admin about failure after max retries
        if (newRetryCount >= 3) {
            console.error(`🚨 Max retries reached for booking ${booking.booking_ref}.`);
            if (notificationsService && notificationsService.sendPaymentFailureNotification) {
                await notificationsService.sendPaymentFailureNotification(booking.booking_ref, error.message);
            }
        }
    }
};

/**
 * Helper to sync status across tables
 */
const updateBookingStatus = async (bookingRef, status) => {
    await pool.query('UPDATE form_bookings SET payment_status = ?, updated_at = NOW() WHERE booking_ref = ?', [status, bookingRef]);
    await pool.query('UPDATE reservations SET payment_status = ? WHERE form_booking_ref = ?', [status, bookingRef]);
};

module.exports = { startChargeScheduler, processEligiblePayments };
