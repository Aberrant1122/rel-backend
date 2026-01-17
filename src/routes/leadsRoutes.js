const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const authMiddleware = require('../middleware/authMiddleware');

// Create a new lead
router.post('/leads', authMiddleware, leadsController.createLead);

// Get all leads
router.get('/leads', authMiddleware, leadsController.getLeads);

// Get a single lead by ID
router.get('/leads/:id', authMiddleware, leadsController.getLeadById);

// Update a lead
router.put('/leads/:id', authMiddleware, leadsController.updateLead);

// Delete a lead
router.delete('/leads/:id', authMiddleware, leadsController.deleteLead);

module.exports = router;
