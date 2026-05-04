const nodemailer = require('nodemailer');

// Set up a transporter
// During testing, if standard env vars are not present, use a fallback transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const getTransporter = async () => transporter;

const sendInvoiceEmail = async (reservation) => {
    try {
        const mailTransporter = await getTransporter();
        
        // Ensure minimum valid fields exist
        if (!reservation || !reservation.passenger_email) {
            console.error('Cannot send invoice: No passenger email provided.');
            return false;
        }

        const formattedPrice = reservation.price ? parseFloat(reservation.price).toFixed(2) : '0.00';
        
        let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #08704fff; padding: 24px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Payment Received</h1>
                <p style="color: #e2e8f0; margin-top: 8px;">Receipt for Reservation #${reservation.reservation_number || 'N/A'}</p>
            </div>
            
            <div style="padding: 24px;">
                <p style="font-size: 16px;">Hello <strong>${reservation.passenger_name || 'Valued Customer'}</strong>,</p>
                <p>We've successfully received your payment for your upcoming trip. Thank you for choosing our service!</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 24px;">
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Booking Status</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #4CAF50;">PAID</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Date & Time</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.pickup_date || 'N/A'} at ${reservation.pickup_time || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Pickup</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.pickup_location || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Dropoff</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.dropoff_location || 'N/A'}</td>
                    </tr>
                </table>

                <div style="background-color: #f9f9f9; padding: 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 18px; font-weight: bold;">Total Paid</span>
                    <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">$${formattedPrice}</span>
                </div>

                <p style="margin-top: 32px; font-size: 14px; color: #666; text-align: center;">
                    If you have any questions regarding this invoice, please <a href="mailto:support@example.com" style="color: #0066cc;">contact our support team</a>.
                </p>
            </div>
            
            <div style="background-color: #f1f1f1; padding: 16px; text-align: center; font-size: 12px; color: #888;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} royal_executive_limo. All rights reserved.</p>
            </div>
        </div>`;

        const info = await mailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: reservation.passenger_email,
            subject: `Invoice for Reservation #${reservation.reservation_number || 'N/A'}`,
            html: htmlContent
        });

        console.log(`[EmailService] Invoice sent for Reservation ${reservation.reservation_number}: ${info.messageId}`);
        
        // If testing with ethereal, log the preview URL
        if (!process.env.SMTP_HOST && info.messageId) {
            console.log('[EmailService] Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send invoice email:', error);
        return false;
    }
};

/**
 * Send a booking confirmation email when a reservation is created with pending payment.
 * @param {object} reservation - Reservation object with passenger info and trip details
 */
const sendBookingConfirmationEmail = async (reservation) => {
    try {
        const mailTransporter = await getTransporter();

        if (!reservation || !reservation.passenger_email) {
            console.error('[EmailService] Cannot send confirmation: No passenger email provided.');
            return false;
        }

        const formattedPrice = reservation.price ? parseFloat(reservation.price).toFixed(2) : '0.00';

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #08704fff; padding: 24px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Booking Received</h1>
                <p style="color: #e2e8f0; margin-top: 8px;">Reservation #${reservation.reservation_number || 'N/A'}</p>
            </div>

            <div style="padding: 24px;">
                <p style="font-size: 16px;">Hello <strong>${reservation.passenger_name || 'Valued Customer'}</strong>,</p>
                <p>Thank you for your reservation! We've received your booking and it is currently <strong>pending payment</strong>. We'll send you a confirmation once payment is processed.</p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 24px;">
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Booking Status</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #f59e0b;">PENDING PAYMENT</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Date &amp; Time</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.pickup_date || 'N/A'} at ${reservation.pickup_time || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Pickup</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.pickup_location || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #666;">Dropoff</td>
                        <td style="padding: 12px 0; text-align: right;">${reservation.dropoff_location || 'N/A'}</td>
                    </tr>
                </table>

                <div style="background-color: #f9f9f9; padding: 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 18px; font-weight: bold;">Total Amount</span>
                    <span style="font-size: 24px; font-weight: bold; color: #1a1a1a;">$${formattedPrice}</span>
                </div>

                <p style="margin-top: 32px; font-size: 14px; color: #666; text-align: center;">
                    Questions? <a href="mailto:support@example.com" style="color: #0066cc;">Contact our support team</a>.
                </p>
            </div>

            <div style="background-color: #f1f1f1; padding: 16px; text-align: center; font-size: 12px; color: #888;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} royal_executive_limo. All rights reserved.</p>
            </div>
        </div>`;

        const info = await mailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: reservation.passenger_email,
            subject: `Booking Confirmation - Reservation #${reservation.reservation_number || 'N/A'}`,
            html: htmlContent
        });

        console.log(`[EmailService] Booking confirmation sent for Reservation ${reservation.reservation_number}: ${info.messageId}`);

        if (!process.env.SMTP_HOST && info.messageId) {
            console.log('[EmailService] Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send booking confirmation email:', error);
        return false;
    }
};

/**
 * Send a password reset email with a reset link.
 */
const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
    try {
        const mailTransporter = await getTransporter();

        if (!email) {
            console.error('[EmailService] Cannot send reset email: No email provided.');
            return false;
        }

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #08704fff; padding: 24px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Password Reset</h1>
            </div>
            <div style="padding: 24px;">
                <p style="font-size: 16px;">Hello <strong>${name || 'there'}</strong>,</p>
                <p>We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>1 hour</strong>.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" style="background-color: #08704fff; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="font-size: 13px; color: #888;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 16px; text-align: center; font-size: 12px; color: #888;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} royal_executive_limo. All rights reserved.</p>
            </div>
        </div>`;

        const info = await mailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Password Reset Request',
            html: htmlContent
        });

        console.log(`[EmailService] Password reset email sent to ${email}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send password reset email:', error);
        return false;
    }
};

module.exports = {
    sendInvoiceEmail,
    sendBookingConfirmationEmail,
    sendPasswordResetEmail
};
