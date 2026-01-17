/**
 * Quick verification script to check if integration is working
 * Run: node verify-integration.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying CRM Integration...\n');

let allGood = true;

// Check if files exist
const filesToCheck = [
    { path: 'src/controllers/dashboardController.js', name: 'Dashboard Controller' },
    { path: 'src/controllers/pipelineController.js', name: 'Pipeline Controller' },
    { path: 'src/controllers/analyticsController.js', name: 'Analytics Controller' },
    { path: 'src/routes/dashboardRoutes.js', name: 'Dashboard Routes' },
    { path: 'src/routes/pipelineRoutes.js', name: 'Pipeline Routes' },
    { path: 'src/routes/analyticsRoutes.js', name: 'Analytics Routes' },
];

console.log('📁 Checking Backend Files:\n');

filesToCheck.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file.path));
    if (exists) {
        console.log(`✅ ${file.name}`);
    } else {
        console.log(`❌ ${file.name} - MISSING!`);
        allGood = false;
    }
});

// Check if routes are registered
console.log('\n📋 Checking Routes Registration:\n');

const routesIndexPath = path.join(__dirname, 'src/routes/index.js');
if (fs.existsSync(routesIndexPath)) {
    const routesContent = fs.readFileSync(routesIndexPath, 'utf8');
    
    const checks = [
        { text: 'dashboardRoutes', name: 'Dashboard Routes Import' },
        { text: 'pipelineRoutes', name: 'Pipeline Routes Import' },
        { text: 'analyticsRoutes', name: 'Analytics Routes Import' },
        { text: "router.use('/', dashboardRoutes)", name: 'Dashboard Routes Mounted' },
        { text: "router.use('/', pipelineRoutes)", name: 'Pipeline Routes Mounted' },
        { text: "router.use('/', analyticsRoutes)", name: 'Analytics Routes Mounted' },
    ];
    
    checks.forEach(check => {
        if (routesContent.includes(check.text)) {
            console.log(`✅ ${check.name}`);
        } else {
            console.log(`❌ ${check.name} - NOT FOUND!`);
            allGood = false;
        }
    });
} else {
    console.log('❌ routes/index.js not found!');
    allGood = false;
}

// Check syntax
console.log('\n🔧 Checking File Syntax:\n');

const filesToValidate = [
    'src/controllers/dashboardController.js',
    'src/controllers/pipelineController.js',
    'src/controllers/analyticsController.js',
    'src/routes/dashboardRoutes.js',
    'src/routes/pipelineRoutes.js',
    'src/routes/analyticsRoutes.js',
];

const { execSync } = require('child_process');

filesToValidate.forEach(file => {
    try {
        execSync(`node --check ${file}`, { stdio: 'pipe' });
        console.log(`✅ ${file} - Valid syntax`);
    } catch (error) {
        console.log(`❌ ${file} - Syntax error!`);
        allGood = false;
    }
});

// Check environment
console.log('\n🌍 Checking Environment:\n');

if (fs.existsSync('.env')) {
    console.log('✅ .env file exists');
    const envContent = fs.readFileSync('.env', 'utf8');
    
    const envVars = ['PORT', 'DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
    envVars.forEach(varName => {
        if (envContent.includes(varName)) {
            console.log(`✅ ${varName} configured`);
        } else {
            console.log(`⚠️  ${varName} not found in .env`);
        }
    });
} else {
    console.log('❌ .env file not found!');
    allGood = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
    console.log('✅ All checks passed! Integration is complete.\n');
    console.log('📝 Next Steps:');
    console.log('1. Restart backend: npm start');
    console.log('2. Restart frontend: cd ../leads-crm && npm run dev');
    console.log('3. Clear browser cache and refresh');
    console.log('4. Login to the application');
    console.log('5. Check Dashboard, Pipeline, and Analytics pages\n');
} else {
    console.log('❌ Some checks failed. Please review the errors above.\n');
}
console.log('='.repeat(50) + '\n');
