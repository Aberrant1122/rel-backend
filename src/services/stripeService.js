const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Handle Stripe Service operations following best practices
 */

/**
 * Create or Retrieve a Stripe Customer
 * @param {Object} customerData - { email, name, phone }
 */
const createCustomer = async ({ email, name, phone }) => {
    try {
        // Search for existing customer first to avoid duplicates
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length > 0) {
            return existing.data[0];
        }

        const customer = await stripe.customers.create({
            email,
            name,
            phone,
            metadata: { source: 'transport_booking_app' }
        });
        return customer;
    } catch (error) {
        console.error('Stripe createCustomer Error:', error);
        throw error;
    }
};

/**
 * Create a SetupIntent to save card for later use
 * @param {string} customerId 
 */
const createSetupIntent = async (customerId) => {
    try {
        return await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            usage: 'off_session', // Essential for charging when customer is not present
        });
    } catch (error) {
        console.error('Stripe createSetupIntent Error:', error);
        throw error;
    }
};

/**
 * Charge a saved card off-session
 * @param {Object} data - { amount, customerId, paymentMethodId, bookingId, currency }
 */
const chargeSavedCard = async ({ amount, customerId, paymentMethodId, bookingId, currency = 'usd', idempotencyKey }) => {
    try {
        // Ensure amount is in cents and rounded
        const unitAmount = Math.round(parseFloat(amount) * 100);

        const options = {};
        if (idempotencyKey) {
            options.idempotencyKey = idempotencyKey;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: unitAmount,
            currency: currency.toLowerCase(),
            customer: customerId,
            payment_method: paymentMethodId,
            off_session: true, // Indicates customer is not in session
            confirm: true,    // Attempt to authorize/capture immediately
            description: `Scheduled charge for booking: ${bookingId}`,
            metadata: { booking_id: bookingId },
            // If the card requires authentication (3DS), this will fail with an error 
            // that we catch in the scheduler/controller.
        }, options);

        return paymentIntent;
    } catch (error) {
        console.error(`Stripe chargeSavedCard Error [Booking: ${bookingId}]:`, error.message);
        throw error;
    }
};

/**
 * Retrieve a SetupIntent
 */
const retrieveSetupIntent = async (setupIntentId) => {
    return await stripe.setupIntents.retrieve(setupIntentId);
};

/**
 * Retrieve a Checkout Session
 */
const retrieveCheckoutSession = async (sessionId) => {
    return await stripe.checkout.sessions.retrieve(sessionId);
};

module.exports = {
    createCustomer,
    createSetupIntent,
    chargeSavedCard,
    retrieveSetupIntent,
    retrieveCheckoutSession,
    stripe
};
