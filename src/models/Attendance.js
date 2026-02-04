const { pool } = require('../config/database');

class Attendance {
    static async checkIn(userId) {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Check if already checked in today
        const [existing] = await pool.query(
            'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
            [userId, today]
        );

        if (existing.length > 0) {
            throw new Error('Already checked in for today');
        }

        const query = 'INSERT INTO attendance (user_id, date, check_in) VALUES (?, ?, ?)';
        const [result] = await pool.query(query, [userId, today, now]);

        return { id: result.insertId, user_id: userId, date: today, check_in: now };
    }

    static async checkOut(userId) {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // Check if checked in today and not already checked out
        const [existing] = await pool.query(
            'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
            [userId, today]
        );

        if (existing.length === 0) {
            throw new Error('No check-in record found for today');
        }

        if (existing[0].check_out) {
            throw new Error('Already checked out for today');
        }

        const query = 'UPDATE attendance SET check_out = ? WHERE id = ?';
        await pool.query(query, [now, existing[0].id]);

        return { ...existing[0], check_out: now };
    }

    static async getTodayStatus(userId) {
        const today = new Date().toISOString().split('T')[0];
        const [rows] = await pool.query(
            'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
            [userId, today]
        );
        return rows[0] || null;
    }

    static async getAllToday() {
        const today = new Date().toISOString().split('T')[0];
        // Get all employees and their attendance for today
        const query = `
            SELECT u.id, u.name, u.email, a.check_in, a.check_out, 
            CASE WHEN a.id IS NOT NULL THEN 'present' ELSE 'absent' END as status
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id AND a.date = ?
            WHERE u.role = 'employee'
        `;
        const [rows] = await pool.query(query, [today]);
        return rows;
    }

    static async getRecords(filters) {
        let query = `
            SELECT a.*, u.name as employee_name, u.email as employee_email
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.date) {
            query += ' AND a.date = ?';
            params.push(filters.date);
        }

        if (filters.employeeName) {
            query += ' AND u.name LIKE ?';
            params.push(`%${filters.employeeName}%`);
        }

        query += ' ORDER BY a.date DESC, a.check_in DESC';

        const [rows] = await pool.query(query, params);
        return rows;
    }
}

module.exports = Attendance;
