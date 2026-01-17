const { pool } = require('../config/database');

/**
 * Get all tasks for a user with optional filters
 */
const getTasks = async (userId, filters = {}) => {
    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [userId];

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }

    if (filters.priority) {
        query += ' AND priority = ?';
        params.push(filters.priority);
    }

    if (filters.lead_id) {
        query += ' AND lead_id = ?';
        params.push(filters.lead_id);
    }

    query += ' ORDER BY due_date ASC, created_at DESC';

    const [tasks] = await pool.query(query, params);
    return tasks;
};

/**
 * Get a single task by ID
 */
const getTaskById = async (taskId, userId) => {
    const [tasks] = await pool.query(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
    );
    return tasks[0];
};

/**
 * Create a new task
 */
const createTask = async (taskData) => {
    const { title, description, due_date, priority, status, lead_id, user_id } = taskData;

    const [result] = await pool.query(
        `INSERT INTO tasks (title, description, due_date, priority, status, lead_id, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, due_date, priority, status, lead_id, user_id]
    );

    const [task] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    return task[0];
};

/**
 * Update a task
 */
const updateTask = async (taskId, userId, taskData) => {
    const updates = [];
    const params = [];

    if (taskData.title !== undefined) {
        updates.push('title = ?');
        params.push(taskData.title);
    }
    if (taskData.description !== undefined) {
        updates.push('description = ?');
        params.push(taskData.description);
    }
    if (taskData.due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(taskData.due_date);
    }
    if (taskData.priority !== undefined) {
        updates.push('priority = ?');
        params.push(taskData.priority);
    }
    if (taskData.status !== undefined) {
        updates.push('status = ?');
        params.push(taskData.status);
    }
    if (taskData.lead_id !== undefined) {
        updates.push('lead_id = ?');
        params.push(taskData.lead_id);
    }

    if (updates.length === 0) {
        return false;
    }

    params.push(taskId, userId);

    const [result] = await pool.query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        params
    );

    return result.affectedRows > 0;
};

/**
 * Update task status only
 */
const updateTaskStatus = async (taskId, userId, status) => {
    const [result] = await pool.query(
        'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [status, taskId, userId]
    );

    return result.affectedRows > 0;
};

/**
 * Delete a task
 */
const deleteTask = async (taskId, userId) => {
    const [result] = await pool.query(
        'DELETE FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
    );

    return result.affectedRows > 0;
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask
};
