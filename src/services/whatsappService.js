const axios = require('axios');

class WhatsAppService {
    constructor() {
        this.token = process.env.WHATSAPP_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_ID;
        this.apiVersion = 'v22.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    }

    /**
     * Send a text message via WhatsApp Cloud API
     * @param {string} to - Recipient phone number (with country code, no + sign)
     * @param {string} message - Message text to send
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendMessage(to, message) {
        if (!this.token || !this.phoneNumberId) {
            throw new Error('WhatsApp credentials not configured. Check WHATSAPP_TOKEN and WHATSAPP_PHONE_ID');
        }

        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'text',
            text: {
                preview_url: false,
                body: message
            }
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ WhatsApp message sent successfully:', {
                to,
                messageId: response.data.messages?.[0]?.id
            });

            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Failed to send WhatsApp message:', {
                to,
                error: error.response?.data || error.message
            });

            throw {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Send a template message via WhatsApp Cloud API
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Name of the approved template
     * @param {string} languageCode - Language code (e.g., 'en', 'en_US')
     * @param {Array} components - Template components (optional)
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
        if (!this.token || !this.phoneNumberId) {
            throw new Error('WhatsApp credentials not configured');
        }

        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: languageCode
                }
            }
        };

        if (components.length > 0) {
            payload.template.components = components;
        }

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ WhatsApp template message sent:', {
                to,
                template: templateName,
                messageId: response.data.messages?.[0]?.id
            });

            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Failed to send template message:', error.response?.data || error.message);
            throw {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Mark a message as read
     * @param {string} messageId - WhatsApp message ID
     * @returns {Promise<Object>}
     */
    async markAsRead(messageId) {
        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Failed to mark message as read:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate webhook signature (for production security)
     * @param {string} signature - X-Hub-Signature-256 header value
     * @param {string} body - Raw request body
     * @returns {boolean}
     */
    validateSignature(signature, body) {
        const crypto = require('crypto');
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        
        if (!appSecret) {
            console.warn('⚠️ WHATSAPP_APP_SECRET not set - skipping signature validation');
            return true;
        }

        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', appSecret)
            .update(body)
            .digest('hex');

        return signature === expectedSignature;
    }
}

module.exports = new WhatsAppService();
