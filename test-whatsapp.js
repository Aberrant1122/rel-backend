/**
 * WhatsApp Integration Test Script
 * Run this to test your WhatsApp API setup
 * 
 * Usage: node test-whatsapp.js
 */

require('dotenv').config();
const axios = require('axios');

const config = {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    businessId: process.env.WHATSAPP_BUSINESS_ID
};

console.log('\n🔍 WhatsApp Configuration Check\n');
console.log('================================');

// Check configuration
let hasErrors = false;

if (!config.token) {
    console.log('❌ WHATSAPP_TOKEN is missing');
    hasErrors = true;
} else {
    console.log('✅ WHATSAPP_TOKEN is set');
}

if (!config.phoneNumberId) {
    console.log('❌ WHATSAPP_PHONE_ID is missing');
    hasErrors = true;
} else {
    console.log('✅ WHATSAPP_PHONE_ID is set:', config.phoneNumberId);
}

if (!config.verifyToken) {
    console.log('❌ WHATSAPP_VERIFY_TOKEN is missing');
    hasErrors = true;
} else {
    console.log('✅ WHATSAPP_VERIFY_TOKEN is set');
}

if (!config.businessId) {
    console.log('⚠️  WHATSAPP_BUSINESS_ID is missing (optional)');
} else {
    console.log('✅ WHATSAPP_BUSINESS_ID is set:', config.businessId);
}

console.log('================================\n');

if (hasErrors) {
    console.log('❌ Configuration incomplete. Please check your .env file.\n');
    process.exit(1);
}

// Test API connection
async function testWhatsAppAPI() {
    console.log('🧪 Testing WhatsApp API Connection...\n');

    try {
        const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${config.token}`
            }
        });

        console.log('✅ API Connection Successful!\n');
        console.log('Phone Number Details:');
        console.log('  - ID:', response.data.id);
        console.log('  - Display Name:', response.data.display_phone_number);
        console.log('  - Quality Rating:', response.data.quality_rating || 'N/A');
        console.log('  - Verified Name:', response.data.verified_name || 'N/A');
        console.log('\n✅ Your WhatsApp API is configured correctly!\n');
        
        console.log('📝 Next Steps:');
        console.log('  1. Start your server: npm run dev');
        console.log('  2. Start ngrok: ngrok http 5000');
        console.log('  3. Configure webhook in Meta dashboard');
        console.log('  4. Send a test message from Meta dashboard\n');

    } catch (error) {
        console.log('❌ API Connection Failed!\n');
        
        if (error.response) {
            console.log('Error Details:');
            console.log('  - Status:', error.response.status);
            console.log('  - Message:', error.response.data.error?.message || 'Unknown error');
            console.log('  - Type:', error.response.data.error?.type || 'N/A');
            
            if (error.response.status === 401) {
                console.log('\n💡 Tip: Your access token may be expired or invalid.');
                console.log('   Generate a new token at: https://developers.facebook.com/apps/');
            }
        } else {
            console.log('Error:', error.message);
        }
        
        console.log('\n');
        process.exit(1);
    }
}

// Test database connection
async function testDatabase() {
    console.log('🗄️  Testing Database Connection...\n');
    
    try {
        const { testConnection } = require('./src/config/database');
        const connected = await testConnection();
        
        if (connected) {
            console.log('✅ Database connection successful!\n');
            
            // Check if tables exist
            const { pool } = require('./src/config/database');
            const [tables] = await pool.query("SHOW TABLES LIKE 'leads'");
            
            if (tables.length > 0) {
                console.log('✅ Leads table exists');
                
                // Check other tables
                const [msgTables] = await pool.query("SHOW TABLES LIKE 'lead_messages'");
                const [timelineTables] = await pool.query("SHOW TABLES LIKE 'lead_timeline'");
                
                if (msgTables.length > 0) console.log('✅ Lead messages table exists');
                else console.log('⚠️  Lead messages table missing - run: source database/whatsapp_schema.sql');
                
                if (timelineTables.length > 0) console.log('✅ Lead timeline table exists');
                else console.log('⚠️  Lead timeline table missing - run: source database/whatsapp_schema.sql');
                
            } else {
                console.log('⚠️  Leads table not found');
                console.log('   Run: source database/whatsapp_schema.sql');
            }
            console.log('');
        } else {
            console.log('❌ Database connection failed');
            console.log('   Check your DB credentials in .env\n');
        }
    } catch (error) {
        console.log('❌ Database test failed:', error.message, '\n');
    }
}

// Run tests
async function runTests() {
    await testDatabase();
    await testWhatsAppAPI();
}

runTests();
