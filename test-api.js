/**
 * Test script to verify API endpoints are working
 * Run: node test-api.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAPI() {
    console.log('🧪 Testing CRM API Endpoints\n');

    try {
        // Test 1: Health check
        console.log('1️⃣ Testing health endpoint...');
        const health = await axios.get(`${API_URL}/health`);
        console.log('✅ Health check:', health.data);
        console.log();

        // Test 2: Get all leads
        console.log('2️⃣ Testing GET /api/leads...');
        const leadsResponse = await axios.get(`${API_URL}/leads`);
        console.log('✅ Leads response:', {
            success: leadsResponse.data.success,
            totalLeads: leadsResponse.data.data.total,
            leadsCount: leadsResponse.data.data.leads.length
        });
        
        if (leadsResponse.data.data.leads.length > 0) {
            const firstLead = leadsResponse.data.data.leads[0];
            console.log('📋 First lead:', {
                id: firstLead.id,
                name: firstLead.name,
                phone: firstLead.phone,
                stage: firstLead.stage,
                source: firstLead.source
            });
            console.log();

            // Test 3: Get lead details
            console.log(`3️⃣ Testing GET /api/leads/${firstLead.id}...`);
            const leadDetails = await axios.get(`${API_URL}/leads/${firstLead.id}`);
            console.log('✅ Lead details:', {
                success: leadDetails.data.success,
                leadName: leadDetails.data.lead.name,
                messagesCount: leadDetails.data.lead.messages.length,
                timelineCount: leadDetails.data.lead.timeline.length
            });
            console.log();
        } else {
            console.log('⚠️ No leads found in database');
            console.log('💡 Send a WhatsApp message to create a test lead');
            console.log();
        }

        console.log('✅ All API tests passed!\n');
        console.log('🎉 Your backend is ready to use!');
        console.log('📱 Frontend can now connect to: ' + API_URL);

    } catch (error) {
        console.error('❌ API test failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Make sure the backend server is running:');
            console.error('   cd leads-crm-backend');
            console.error('   node server.js');
        } else if (error.response) {
            console.error('Response:', error.response.data);
        }
        
        process.exit(1);
    }
}

testAPI();
