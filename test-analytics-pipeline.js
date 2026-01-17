/**
 * Test script for Pipeline and Analytics APIs
 * 
 * Usage: node test-analytics-pipeline.js
 * 
 * Make sure to:
 * 1. Start the backend server first
 * 2. Have a valid user account (or create one)
 * 3. Update the credentials below
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Update these credentials with a valid user
const TEST_USER = {
    email: 'test@example.com',
    password: 'password123'
};

let accessToken = '';

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${API_URL}/auth/login`, TEST_USER);
        accessToken = response.data.data.accessToken;
        console.log('✅ Login successful\n');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.message || error.message);
        console.log('\n💡 Make sure you have a registered user or update TEST_USER credentials\n');
        return false;
    }
}

async function testPipelineAPIs() {
    console.log('📊 Testing Pipeline APIs...\n');

    try {
        // Test 1: Get Pipeline Data
        console.log('1️⃣  Testing GET /api/pipeline');
        const pipelineResponse = await axios.get(`${API_URL}/pipeline`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Pipeline data retrieved');
        console.log(`   Found ${pipelineResponse.data.data.length} stages`);
        const totalLeads = pipelineResponse.data.data.reduce((sum, stage) => sum + stage.count, 0);
        console.log(`   Total leads: ${totalLeads}\n`);

        // Test 2: Get Pipeline Stats
        console.log('2️⃣  Testing GET /api/pipeline/stats');
        const statsResponse = await axios.get(`${API_URL}/pipeline/stats`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Pipeline stats retrieved');
        console.log(`   Stats for ${statsResponse.data.data.length} stages\n`);

        // Test 3: Update Lead Stage (if there are leads)
        if (totalLeads > 0) {
            const firstStageWithLeads = pipelineResponse.data.data.find(s => s.leads.length > 0);
            if (firstStageWithLeads && firstStageWithLeads.leads[0]) {
                const leadId = firstStageWithLeads.leads[0].id;
                const currentStage = firstStageWithLeads.stage;
                
                console.log(`3️⃣  Testing PATCH /api/pipeline/leads/${leadId}/stage`);
                await axios.patch(
                    `${API_URL}/pipeline/leads/${leadId}/stage`,
                    { stage: currentStage },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                console.log('✅ Lead stage updated successfully\n');
            }
        }

        console.log('✅ All Pipeline API tests passed!\n');
        return true;
    } catch (error) {
        console.error('❌ Pipeline API test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testAnalyticsAPIs() {
    console.log('📈 Testing Analytics APIs...\n');

    try {
        // Test 1: Get Revenue Trend
        console.log('1️⃣  Testing GET /api/analytics/revenue-trend');
        const revenueResponse = await axios.get(`${API_URL}/analytics/revenue-trend?months=6`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Revenue trend data retrieved');
        console.log(`   Data points: ${revenueResponse.data.data.length}\n`);

        // Test 2: Get Conversion Funnel
        console.log('2️⃣  Testing GET /api/analytics/conversion-funnel');
        const funnelResponse = await axios.get(`${API_URL}/analytics/conversion-funnel`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Conversion funnel data retrieved');
        console.log(`   Funnel stages: ${funnelResponse.data.data.length}\n`);

        // Test 3: Get Performance Metrics
        console.log('3️⃣  Testing GET /api/analytics/performance');
        const performanceResponse = await axios.get(`${API_URL}/analytics/performance`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Performance metrics retrieved');
        console.log(`   Metrics: ${performanceResponse.data.data.length}\n`);

        // Test 4: Get Pipeline Distribution
        console.log('4️⃣  Testing GET /api/analytics/pipeline-distribution');
        const distributionResponse = await axios.get(`${API_URL}/analytics/pipeline-distribution`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Pipeline distribution retrieved');
        console.log(`   Stages: ${distributionResponse.data.data.length}\n`);

        // Test 5: Get Analytics Overview
        console.log('5️⃣  Testing GET /api/analytics/overview');
        const overviewResponse = await axios.get(`${API_URL}/analytics/overview?months=6`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Analytics overview retrieved');
        console.log('   Contains: revenueTrend, conversionFunnel, performanceMetrics, pipelineDistribution\n');

        console.log('✅ All Analytics API tests passed!\n');
        return true;
    } catch (error) {
        console.error('❌ Analytics API test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testDashboardAPIs() {
    console.log('📊 Testing Dashboard APIs...\n');

    try {
        // Test 1: Get Dashboard Stats
        console.log('1️⃣  Testing GET /api/dashboard/stats');
        const statsResponse = await axios.get(`${API_URL}/dashboard/stats`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Dashboard stats retrieved');
        console.log(`   Total leads: ${statsResponse.data.data.totalLeads}`);
        console.log(`   Active deals: ${statsResponse.data.data.activeDeals}\n`);

        // Test 2: Get KPIs
        console.log('2️⃣  Testing GET /api/dashboard/kpis');
        const kpisResponse = await axios.get(`${API_URL}/dashboard/kpis`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Dashboard KPIs retrieved');
        console.log(`   KPIs: ${kpisResponse.data.data.length}\n`);

        // Test 3: Get Pipeline Overview
        console.log('3️⃣  Testing GET /api/dashboard/pipeline-overview');
        const pipelineResponse = await axios.get(`${API_URL}/dashboard/pipeline-overview`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Pipeline overview retrieved');
        console.log(`   Stages: ${pipelineResponse.data.data.length}\n`);

        console.log('✅ All Dashboard API tests passed!\n');
        return true;
    } catch (error) {
        console.error('❌ Dashboard API test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testLeadsAPIs() {
    console.log('👥 Testing Leads APIs...\n');

    try {
        // Test 1: Create a new lead
        console.log('1️⃣  Testing POST /api/leads');
        const testPhone = `+999${Date.now().toString().slice(-7)}`; // Unique phone
        const createResponse = await axios.post(`${API_URL}/leads`, {
            name: 'Test Lead',
            email: 'test@example.com',
            phone: testPhone,
            company: 'Test Company',
            stage: 'New Leads',
            source: 'Website',
            priority: 'Medium',
            value: '5000'
        }, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Lead created successfully');
        const createdLeadId = createResponse.data.data.id;
        console.log(`   Lead ID: ${createdLeadId}\n`);

        // Test 2: Get all leads
        console.log('2️⃣  Testing GET /api/leads');
        const leadsResponse = await axios.get(`${API_URL}/leads`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Leads retrieved');
        console.log(`   Total leads: ${leadsResponse.data.data.total}\n`);

        // Test 3: Get single lead
        console.log(`3️⃣  Testing GET /api/leads/${createdLeadId}`);
        const leadResponse = await axios.get(`${API_URL}/leads/${createdLeadId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Lead details retrieved');
        console.log(`   Lead name: ${leadResponse.data.data.name}\n`);

        // Test 4: Update lead
        console.log(`4️⃣  Testing PUT /api/leads/${createdLeadId}`);
        await axios.put(`${API_URL}/leads/${createdLeadId}`, {
            stage: 'Contacted'
        }, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Lead updated successfully\n');

        // Test 5: Delete lead (cleanup)
        console.log(`5️⃣  Testing DELETE /api/leads/${createdLeadId}`);
        await axios.delete(`${API_URL}/leads/${createdLeadId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Lead deleted successfully\n');

        console.log('✅ All Leads API tests passed!\n');
        return true;
    } catch (error) {
        console.error('❌ Leads API test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting API Tests\n');
    console.log('=' .repeat(50) + '\n');

    const loginSuccess = await login();
    if (!loginSuccess) {
        process.exit(1);
    }

    const dashboardSuccess = await testDashboardAPIs();
    const pipelineSuccess = await testPipelineAPIs();
    const analyticsSuccess = await testAnalyticsAPIs();
    const leadsSuccess = await testLeadsAPIs();

    console.log('=' .repeat(50));
    if (dashboardSuccess && pipelineSuccess && analyticsSuccess && leadsSuccess) {
        console.log('\n🎉 All tests passed successfully!\n');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed. Check the output above.\n');
        process.exit(1);
    }
}

runTests();
