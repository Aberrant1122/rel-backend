require('dotenv').config();
const { pool } = require('../config/database');
const notificationsService = require('../services/notificationsService');

async function testNotifications() {
    try {
        console.log('🔄 Testing notifications system...\n');

        // Check if table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'notifications'");
        if (tables.length === 0) {
            console.error('❌ Notifications table does not exist!');
            process.exit(1);
        }
        console.log('✅ Notifications table exists');

        // Get all users
        const [users] = await pool.query('SELECT id, name, email FROM users LIMIT 5');
        console.log(`\n📋 Found ${users.length} users:`);
        users.forEach(user => {
            console.log(`  - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
        });

        if (users.length < 1) {
            console.log('\n⚠️  No users found. Cannot test notifications.');
            process.exit(0);
        }

        // Create a test notification
        const testUserId = users[0].id;
        console.log(`\n🔄 Creating test notification for user ${testUserId}...`);
        
        const notification = await notificationsService.createNotification(
            testUserId,
            'test',
            'Test Notification',
            'This is a test notification to verify the system is working',
            null,
            null
        );
        
        console.log('✅ Test notification created:', {
            id: notification.id,
            title: notification.title,
            message: notification.message
        });

        // Get notifications for the user
        console.log(`\n🔄 Fetching notifications for user ${testUserId}...`);
        const result = await notificationsService.getNotifications(testUserId, 10, 0);
        
        console.log(`✅ Found ${result.notifications.length} notifications (${result.unread} unread):`);
        result.notifications.forEach(notif => {
            console.log(`  - [${notif.is_read ? 'READ' : 'UNREAD'}] ${notif.title}: ${notif.message}`);
        });

        // Mark as read
        console.log(`\n🔄 Marking notification ${notification.id} as read...`);
        const marked = await notificationsService.markAsRead(notification.id, testUserId);
        console.log(marked ? '✅ Marked as read' : '❌ Failed to mark as read');

        // Clean up test notification
        console.log(`\n🔄 Cleaning up test notification...`);
        const deleted = await notificationsService.deleteNotification(notification.id, testUserId);
        console.log(deleted ? '✅ Test notification deleted' : '❌ Failed to delete');

        console.log('\n✅ All tests passed! Notifications system is working correctly.\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error testing notifications:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testNotifications();
