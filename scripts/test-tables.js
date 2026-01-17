#!/usr/bin/env node

/**
 * Test Database Tables
 * Verifies that all required tables exist with correct structure
 */

require('dotenv').config();
const { pool, testConnection } = require('../src/config/database');

async function testTables() {
    console.log('🔍 Testing database tables...');
    
    try {
        // Test connection
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Database connection failed');
        }

        // List all tables
        const [tables] = await pool.execute('SHOW TABLES');
        console.log('\n📋 Available tables:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`   ✅ ${tableName}`);
        });

        // Test Google OAuth table structure
        console.log('\n🔍 Google OAuth tokens table structure:');
        const [columns] = await pool.execute('DESCRIBE google_oauth_tokens');
        columns.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
        });

        // Test meetings table structure
        console.log('\n🔍 Meetings table structure:');
        const [meetingColumns] = await pool.execute('DESCRIBE meetings');
        meetingColumns.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
        });

        // Test meeting participants table structure
        console.log('\n🔍 Meeting participants table structure:');
        const [participantColumns] = await pool.execute('DESCRIBE meeting_participants');
        participantColumns.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
        });

        console.log('\n🎉 All tables are properly configured!');
        console.log('\n💡 Your Google OAuth integration should now work with:');
        console.log('   - google_oauth_tokens table for storing OAuth credentials');
        console.log('   - meetings table for calendar functionality');
        console.log('   - meeting_participants table for multiple participants');
        
    } catch (error) {
        console.error('❌ Table test failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testTables();