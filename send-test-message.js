/**
 * Send Test WhatsApp Message
 * 
 * Usage: node send-test-message.js <phone_number> <message>
 * Example: node send-test-message.js 1234567890 "Hello from CRM!"
 */

require('dotenv').config();
const whatsappService = require('./src/services/whatsappService');

const phone = process.argv[2];
const message = process.argv[3];

if (!phone || !message) {
    console.log('\n❌ Usage: node send-test-message.js <phone_number> <message>\n');
    console.log('Example: node send-test-message.js 1234567890 "Hello from CRM!"\n');
    console.log('Note: Phone number should include country code without + sign\n');
    process.exit(1);
}

async function sendTestMessage() {
    console.log('\n📤 Sending WhatsApp Message...\n');
    console.log('To:', phone);
    console.log('Message:', message);
    console.log('');

    try {
        const result = await whatsappService.sendMessage(phone, message);
        
        if (result.success) {
            console.log('✅ Message sent successfully!');
            console.log('Message ID:', result.messageId);
            console.log('\n💡 Check WhatsApp on your phone to see the message.\n');
        } else {
            console.log('❌ Failed to send message');
            console.log('Error:', result.error);
        }
    } catch (error) {
        console.log('❌ Error sending message:', error.error || error.message);
        
        if (error.statusCode === 401) {
            console.log('\n💡 Your access token may be expired or invalid.');
        } else if (error.statusCode === 400) {
            console.log('\n💡 Check the phone number format (should include country code, no + sign).');
        }
        console.log('');
    }
}

sendTestMessage();
