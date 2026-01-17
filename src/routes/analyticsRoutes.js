const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

// Get revenue and leads trend data
router.get('/analytics/revenue-trend', authMiddleware, analyticsController.getRevenueTrend);

// Get conversion funnel data
router.get('/analytics/conversion-funnel', authMiddleware, analyticsController.getConversionFunnel);

// Get performance metrics
router.get('/analytics/performance', authMiddleware, analyticsController.getPerformanceMetrics);

// Get pipeline distribution
router.get('/analytics/pipeline-distribution', authMiddleware, analyticsController.getPipelineDistribution);

// Get overview dashboard data (all analytics in one call)
router.get('/analytics/overview', authMiddleware, analyticsController.getOverview);

module.exports = router;
