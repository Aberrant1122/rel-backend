const tasksService = require('../services/tasksService');
const notificationsService = require('../services/notificationsService');

/**
 * Get all tasks for the authenticated user
 */
const getTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, priority, lead_id, assigned_to } = req.query;

        const tasks = await tasksService.getTasks(userId, { status, priority, lead_id, assigned_to });

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get a single task by ID
 */
const getTaskById = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = parseInt(req.params.id);

        const task = await tasksService.getTaskById(taskId, userId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create a new task
 */
const createTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, due_date, priority, status, lead_id, assigned_to } = req.body;

        // Validation
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        const taskData = {
            title,
            description,
            due_date,
            priority: priority || 'Medium',
            status: status || 'Pending',
            lead_id,
            assigned_to,
            user_id: userId
        };

        const task = await tasksService.createTask(taskData);

        // Create notification if task is assigned to someone
        if (assigned_to && assigned_to !== userId) {
            try {
                const { pool } = require('../config/database');
                
                // Get the assigner's name
                const [users] = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
                const assignerName = users[0]?.name || 'Admin';
                
                await notificationsService.createNotification(
                    assigned_to,
                    'task_assigned',
                    'New Task Assigned',
                    `${assignerName} assigned you a task: ${title}`,
                    task.id,
                    'task'
                );
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
                // Don't fail the request if notification fails
            }
        }

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update a task
 */
const updateTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = parseInt(req.params.id);
        const { title, description, due_date, priority, status, lead_id, assigned_to } = req.body;

        const taskData = {
            title,
            description,
            due_date,
            priority,
            status,
            lead_id,
            assigned_to
        };

        // Get current task to check if assigned_to changed
        // Need to check both user_id and assigned_to
        const { pool } = require('../config/database');
        const [currentTasks] = await pool.query(
            'SELECT * FROM tasks WHERE id = ? AND (user_id = ? OR assigned_to = ?)',
            [taskId, userId, userId]
        );
        const currentTask = currentTasks[0];
        
        if (!currentTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }
        
        const updated = await tasksService.updateTask(taskId, userId, taskData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Create notification if task assignment changed
        if (assigned_to && assigned_to !== userId && currentTask && currentTask.assigned_to !== assigned_to) {
            try {
                // Get the assigner's name
                const [users] = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
                const assignerName = users[0]?.name || 'Admin';
                
                await notificationsService.createNotification(
                    assigned_to,
                    'task_assigned',
                    'Task Assigned to You',
                    `${assignerName} assigned you a task: ${title || currentTask.title}`,
                    taskId,
                    'task'
                );
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
                // Don't fail the request if notification fails
            }
        }

        res.json({
            success: true,
            message: 'Task updated successfully'
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update task status only
 */
const updateTaskStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = parseInt(req.params.id);
        const { status } = req.body;

        // Validation
        const validStatuses = ['Pending', 'In Progress', 'Completed'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (Pending, In Progress, Completed)'
            });
        }

        // Get current task to check who created it
        const { pool } = require('../config/database');
        const [currentTasks] = await pool.query(
            'SELECT * FROM tasks WHERE id = ? AND (user_id = ? OR assigned_to = ?)',
            [taskId, userId, userId]
        );
        const currentTask = currentTasks[0];
        
        if (!currentTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const updated = await tasksService.updateTaskStatus(taskId, userId, status);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Create notification if task is completed and user is not the creator
        if (status === 'Completed' && currentTask.user_id !== userId) {
            try {
                // Get the completer's name
                const [users] = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
                const completerName = users[0]?.name || 'User';
                
                await notificationsService.createNotification(
                    currentTask.user_id,
                    'task_completed',
                    'Task Completed',
                    `${completerName} completed the task: ${currentTask.title}`,
                    taskId,
                    'task'
                );
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
                // Don't fail the request if notification fails
            }
        }

        res.json({
            success: true,
            message: 'Task status updated successfully'
        });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete a task
 */
const deleteTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = parseInt(req.params.id);

        const deleted = await tasksService.deleteTask(taskId, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete task',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask
};
