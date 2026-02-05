const { pool } = require('../config/database');

/**
 * Create a notification
 */
const createNotification = async (userId, type, title, message, relatedId = null, relatedType = null) => {
    const [result] = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
        [userId, type, title, message, relatedId, relatedType]
    );

    const [notification] = await pool.query(
        'SELECT * FROM notifications WHERE id = ?',
        [result.insertId]
    );

    return notification[0];
};

/**
 * Get notifications for a user
 */
const getNotifications = async (userId, limit = 50, offset = 0) => {
    const [notifications] = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );

    const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
        [userId]
    );

    const [unreadResult] = await pool.query(
        'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
    );

    return {
        notifications,
        total: countResult[0].total,
        unread: unreadResult[0].unread
    };
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
    const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [notificationId, userId]
    );

    return result.affectedRows > 0;
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
    const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
    );

    return result.affectedRows;
};

/**
 * Delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
    const [result] = await pool.query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId]
    );

    return result.affectedRows > 0;
};

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
};

