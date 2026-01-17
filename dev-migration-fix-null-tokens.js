/**
 * DEV ONLY - Migration Utility to Fix NULL user_id in google_oauth_tokens
 * 
 * ⚠️  WARNING: THIS IS FOR DEVELOPMENT ONLY ⚠️
 * 
 * This script assigns user_id to existing google_oauth_tokens rows where user_id IS NULL.
 * It should only be used in development environments to fix legacy data.
 * 
 * DO NOT RUN IN PRODUCTION WITHOUT CAREFUL REVIEW
 */

const { pool } = require('./src/config/database');

async function fixNullTokens() {
    console.log('🔧 DEV ONLY: Fixing NULL user_id in google_oauth_tokens');
    console.log('⚠️  This should only be run in development environments');
    
    // Safety check - ensure this is development
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ BLOCKED: This script cannot run in production');
        process.exit(1);
    }
    
    try {
        // First, check if there are any NULL user_id tokens
        const [nullTokens] = await pool.execute(
            'SELECT id, google_email, created_at FROM google_oauth_tokens WHERE user_id IS NULL'
        );
        
        if (nullTokens.length === 0) {
            console.log('✅ No NULL user_id tokens found - nothing to fix');
            return;
        }
        
        console.log(`📋 Found ${nullTokens.length} tokens with NULL user_id:`);
        nullTokens.forEach(token => {
            console.log(`  - ID: ${token.id}, Email: ${token.google_email}, Created: ${token.created_at}`);
        });
        
        // Get the first user from users table (for single-user dev setup)
        const [users] = await pool.execute(
            'SELECT id, email FROM users ORDER BY id ASC LIMIT 1'
        );
        
        if (users.length === 0) {
            console.log('❌ No users found in database - cannot assign tokens');
            return;
        }
        
        const firstUser = users[0];
        console.log(`🎯 Will assign tokens to user: ID=${firstUser.id}, Email=${firstUser.email}`);
        
        // Confirm before proceeding
        console.log('\n⚠️  This will update ALL NULL user_id tokens to user ID', firstUser.id);
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
     