const tasksService = require('../services/tasksService');

/**
 * Get all tasks for the authenticated user
 */
const getTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, priority, lead_id } = req.query;

        const tasks = await tasksService.getTasks(userId, { status, priority, lead_id });

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
        const { title, description, due_date, priority, status, lead_id } = req.body;

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
            user_id: userId
        };

        const task = await tasksService.createTask(taskData);

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
        const { title, description, due_date, priority, status, lead_id } = req.body;

        const taskData = {
            title,
            description,
            due_date,
            priority,
            status,
            lead_id
        };

        const updated = await tasksService.updateTask(taskId, userId, taskData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
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

        const updated = await tasksService.updateTaskStatus(taskId, userId, status);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
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
