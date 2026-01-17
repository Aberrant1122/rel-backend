const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipelineController');
const authMiddleware = require('../middleware/authMiddleware');

// Get pipeline data (leads grouped by stage)
router.get('/pipeline', authMiddleware, pipelineController.getPipelineData);

// Update lead stage (for drag-and-drop)
router.patch('/pipeline/leads/:id/stage', authMiddleware, pipelineController.updateLeadStage);

// Get pipeline statistics
router.get('/pipeline/stats', authMiddleware, pipelineController.getPipelineStats);

module.exports = router;
