const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Route to initiate a SetupIntent. Returns client_secret.
 * Can be public if we allow guest bookings to setup card.
 */
router.post('/initiate-setup', stripeController.initiateSetupIntent);

/**
 * Route to save payment method details after frontend verification.
 */
router.post('/save-payment-method', stripeController.savePaymentMethod);

/**
 * Route to create a Stripe Checkout session in 'setup' mode.
 */
router.post('/checkout-setup', stripeController.createCheckoutSetupSession);

/**
 * Route to retrieve setup intent status and payment method.
 */
router.get('/retrieve-setup-intent', stripeController.retrieveSetupIntent);

/**
 * Route for admin to manually retry a charge immediately.
 */
router.post('/retry-charge', authMiddleware, stripeController.retryCharge);

/**
 * Route to manually trigger the daily/hourly scheduler processing.
 */
router.post('/trigger-scheduler', authMiddleware, async (req, res) => {
    try {
        const { processEligiblePayments } = require('../scheduler/chargeScheduler');
        await processEligiblePayments();
        res.json({ success: true, message: 'Scheduler triggered successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to trigger scheduler', error: error.message });
    }
});

/**
 * Routes for saved payment methods and dashboard charging
 */
router.post('/save-payment-method-for-customer', authMiddleware, stripeController.savePaymentMethodForCustomer);
router.get('/customers/:userId/payment-methods', authMiddleware, stripeController.getCustomerPaymentMethods);
router.delete('/payment-methods/:pmId', authMiddleware, stripeController.deleteCustomerPaymentMethod);
router.post('/charge-customer', authMiddleware, stripeController.chargeCustomerFromDashboard);
router.get('/customers/:userId/charges', authMiddleware, stripeController.getCustomerCharges);

module.exports = router;
