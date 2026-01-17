const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all tasks
router.get('/', tasksController.getTasks);

// Get single task
router.get('/:id', tasksController.getTaskById);

// Create task
router.post('/', tasksController.createTask);

// Update task
router.put('/:id', tasksController.updateTask);

// Update task status only
router.patch('/:id/status', tasksController.updateTaskStatus);

// Delete task
router.delete('/:id', tasksController.deleteTask);

module.exports = router;
