const Lead = require('../models/Lead');
const { pool } = require('../config/database');

/**
 * Get pipeline data - leads grouped by stage
 */
exports.getPipelineData = async (req, res) => {
    try {
        const stages = ['New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost'];
        
        const query = `
            SELECT 
                stage,
                COUNT(*) as count,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', id,
                        'name', name,
                        'phone', phone,
                        'email', email,
                        'source', source,
                        'last_message', last_message,
                        'last_message_at', last_message_at,
                        'created_at', created_at,
                        'updated_at', updated_at
                    )
                ) as leads
            FROM leads
            GROUP BY stage
        `;

        const [results] = await pool.query(query);
        
        // Create a map of stage to leads
        const stageMap = {};
        results.forEach(row => {
            stageMap[row.stage] = {
                count: row.count,
                leads: row.leads || []
            };
        });

        // Ensure all stages are present, even if empty
        const pipelineData = stages.map(stage => ({
            stage: stage,
            count: stageMap[stage]?.count || 0,
            leads: stageMap[stage]?.leads || []
        }));

        res.json({
            success: true,
            data: pipelineData
        });
    } catch (error) {
        console.error('Error fetching pipeline data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pipeline data',
            error: error.message
        });
    }
};

/**
 * Update lead stage (for drag-and-drop functionality)
 */
exports.updateLeadStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;

        const validStages = ['New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost'];
        
        if (!validStages.includes(stage)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stage value'
            });
        }

        const updated = await Lead.update(id, { stage });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        // Add timeline entry for stage change
        await Lead.addTimelineEntry(id, {
            event_type: 'stage_changed',
            description: `Stage changed to ${stage}`,
            metadata: { new_stage: stage }
        });

        res.json({
            success: true,
            message: 'Lead stage updated successfully'
        });
    } catch (error) {
        console.error('Error updating lead stage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lead stage',
            error: error.message
        });
    }
};

/**
 * Get pipeline statistics
 */
exports.getPipelineStats = async (req, res) => {
    try {
        const query = `
            SELECT 
                stage,
                COUNT(*) as count,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
                SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) THEN 1 ELSE 0 END) as week_count
            FROM leads
            GROUP BY stage
        `;

        const [results] = await pool.query(query);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error fetching pipeline stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pipeline statistics',
            error: error.message
        });
    }
};
