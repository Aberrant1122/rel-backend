const Lead = require('../models/Lead');
const { pool } = require('../config/database');

/**
 * Create a new lead
 */
exports.createLead = async (req, res) => {
    try {
        const { name, email, phone, company, stage, source, priority, value } = req.body;

        // Validation
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required'
            });
        }

        // Check if lead with this phone already exists
        const existingLead = await Lead.findByPhone(phone);
        if (existingLead) {
            return res.status(400).json({
                success: false,
                message: 'A lead with this phone number already exists'
            });
        }

        // Map status to stage (frontend uses different names)
        const stageMap = {
            'New Leads': 'New',
            'Contacted': 'Contacted',
            'Qualified': 'Qualified',
            'Proposal': 'Proposal',
            'Negotiation': 'Second Wing',
            'Closed Won': 'Won',
            'Closed Lost': 'Lost'
        };

        const mappedStage = stageMap[stage] || stage || 'New';

        // Create lead
        const leadId = await Lead.create({
            name,
            phone,
            email: email || null,
            stage: mappedStage,
            source: source || 'Website',
            last_message: `Lead created via CRM${company ? ` - Company: ${company}` : ''}`
        });

        // Add timeline entry
        await Lead.addTimelineEntry(leadId, {
            event_type: 'note_added',
            description: `Lead created via CRM${company ? ` - Company: ${company}` : ''}${priority ? ` - Priority: ${priority}` : ''}${value ? ` - Value: $${value}` : ''}`,
            metadata: { company, priority, value }
        });

        // Get the created lead
        const createdLead = await Lead.getLeadWithDetails(leadId);

        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: createdLead
        });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create lead',
            error: error.message
        });
    }
};

/**
 * Get all leads with pagination and filters
 */
exports.getLeads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const stage = req.query.stage;
        const source = req.query.source;

        const filters = {};
        if (stage) filters.stage = stage;
        if (source) filters.source = source;

        const result = await Lead.getAll(page, limit, filters);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leads',
            error: error.message
        });
    }
};

/**
 * Get a single lead by ID
 */
exports.getLeadById = async (req, res) => {
    try {
        const { id } = req.params;

        const lead = await Lead.getLeadWithDetails(id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        res.json({
            success: true,
            data: lead
        });
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch lead',
            error: error.message
        });
    }
};

/**
 * Update a lead
 */
exports.updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await Lead.update(id, updateData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        // Add timeline entry if stage changed
        if (updateData.stage) {
            await Lead.addTimelineEntry(id, {
                event_type: 'stage_changed',
                description: `Stage changed to ${updateData.stage}`,
                metadata: { new_stage: updateData.stage }
            });
        }

        res.json({
            success: true,
            message: 'Lead updated successfully'
        });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lead',
            error: error.message
        });
    }
};

/**
 * Delete a lead
 */
exports.deleteLead = async (req, res) => {
    try {
        const { id } = req.params;

        const query = 'DELETE FROM leads WHERE id = ?';
        const [result] = await pool.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        res.json({
            success: true,
            message: 'Lead deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete lead',
            error: error.message
        });
    }
};
