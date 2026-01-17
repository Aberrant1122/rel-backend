const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const googleOAuthRoutes = require('./googleOAuthRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const pipelineRoutes = require('./pipelineRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const leadsRoutes = require('./leadsRoutes');
const userRoutes = require('./userRoutes');
const tasksRoutes = require('./tasks');
const calendarRoutes = require('./calendarRoutes');
const gmailRoutes = require('./gmailRoutes');
const formsRoutes = require('./formsRoutes');
const ringCentralRoutes = require('./ringCentralRoutes');

// Mount auth routes (includes Google OAuth)
router.use('/auth', authRoutes);
router.use('/auth', googleOAuthRoutes);
router.use('/auth', ringCentralRoutes);

// Mount WhatsApp routes
router.use('/', whatsappRoutes);

// Mount pipeline routes
router.use('/', pipelineRoutes);

// Mount analytics routes
router.use('/', analyticsRoutes);

// Mount dashboard routes
router.use('/', dashboardRoutes);

// Mount leads routes
router.use('/', leadsRoutes);

// Mount user routes
router.use('/', userRoutes);

// Mount tasks routes
router.use('/tasks', tasksRoutes);

// Mount calendar routes
router.use('/', calendarRoutes);

// Mount Gmail routes
router.use('/gmail', gmailRoutes);

// Mount Forms routes
router.use('/forms', formsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'API is running' });
});

// Test endpoint for debugging (no auth required)
router.get('/test-tasks', async (req, res) => {
    try {
        const { pool } = require('../config/database');

        // Check if tasks table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'tasks'");
        const tableExists = tables.length > 0;

        let taskCount = 0;
        let sampleTasks = [];

        if (tableExists) {
            const [count] = await pool.query('SELECT COUNT(*) as total FROM tasks');
            taskCount = count[0].total;

            const [tasks] = await pool.query('SELECT id, title, status, user_id FROM tasks LIMIT 3');
            sampleTasks = tasks;
        }

        res.json({
            success: true,
            data: {
                tableExists,
                taskCount,
                sampleTasks,
                endpoints: {
                    'GET /tasks': 'Get all tasks (auth required)',
                    'PATCH /tasks/:id/status': 'Update task status (auth required)',
                    'POST /tasks': 'Create task (auth required)'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Google OAuth status check (public endpoint for debugging)
router.get('/test-google-oauth', async (req, res) => {
    try {
        const googleOAuthService = require('../services/googleOAuthService');
        const status = await googleOAuthService.getConnectionStatus();

        res.json({
            success: true,
            data: {
                ...status,
                endpoints: {
                    'GET /auth/google': 'Start OAuth flow (redirects to Google)',
                    'GET /auth/google/callback': 'OAuth callback (called by Google)',
                    'GET /auth/google/status': 'Check connection status (auth required)',
                    'POST /auth/google/disconnect': 'Disconnect Google account (auth required)'
                },
                calendarEndpoints: {
                    'POST /calendar/meeting': 'Create meeting (auth required)',
                    'GET /calendar/meetings': 'List meetings (auth required)',
                    'GET /calendar/meeting/:eventId': 'Get meeting (auth required)',
                    'DELETE /calendar/meeting/:eventId': 'Delete meeting (auth required)'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
