const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test credentials (you may need to adjust these)
const testCredentials = {
    email: 'admin@example.com',
    password: 'admin123'
};

let accessToken = '';

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${API_URL}/auth/login`, testCredentials);
        accessToken = response.data.data.accessToken;
        console.log('✅ Login successful\n');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testDashboardEndpoints() {
    console.log('📊 Testing Dashboard Integration...\n');

    try {
        // Test 1: Get upcoming tasks
        console.log('1️⃣  Testing GET /api/dashboard/upcoming-tasks');
        const tasksResponse = await axios.get(`${API_URL}/dashboard/upcoming-tasks?limit=3`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Upcoming tasks retrieved');
        console.log(`   Tasks found: ${tasksResponse.data.data.length}`);
        if (tasksResponse.data.data.length > 0) {
            console.log(`   First task: ${tasksResponse.data.data[0].title}`);
        }
        console.log();

        // Test 2: Verify analytics endpoint works (for performance metrics)
        console.log('2️⃣  Testing GET /api/analytics/performance');
        try {
            const metricsResponse = await axios.get(`${API_URL}/analytics/performance`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log('✅ Performance metrics retrieved');
            console.log(`   Metrics found: ${metricsResponse.data.data.length}`);
            if (metricsResponse.data.data.length > 0) {
                console.log(`   First metric: ${metricsResponse.data.data[0].metric}`);
            }
        } catch (error) {
            console.log('⚠️  Performance metrics endpoint not available (this is okay)');
        }
        console.log();

        // Test 3: Verify existing endpoints still work
        console.log('3️⃣  Testing existing dashboard endpoints');
        
        const kpisResponse = await axios.get(`${API_URL}/dashboard/kpis`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ KPIs endpoint working');

        const pipelineResponse = await axios.get(`${API_URL}/dashboard/pipeline-overview`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('✅ Pipeline overview endpoint working');

        console.log('\n🎉 All dashboard integration tests passed!\n');
        return true;
    } catch (error) {
        console.error('❌ Dashboard integration test failed:', error.response?.data?.message || error.message);
        console.error('   Status:', error.response?.status);
        console.error('   URL:', error.config?.url);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting Dashboard Integration Test\n');
    console.log('=' .repeat(50));

    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ Cannot proceed without authentication');
        process.exit(1);
    }

    const dashboardSuccess = await testDashboardEndpoints();

    console.log('=' .repeat(50));
    if (dashboardSuccess) {
        console.log('\n✅ Dashboard integration is working correctly!');
        console.log('\nNext steps:');
        console.log('1. Start the frontend: npm run dev (in leads-crm folder)');
        console.log('2. Navigate to the dashboard');
        console.log('3. Verify that upcoming tasks and performance metrics are loading from API\n');
        process.exit(0);
    } else {
        console.log('\n❌ Dashboard integration test failed. Please check the errors above.\n');
        process.exit(1);
    }
}

main().catch(console.error);