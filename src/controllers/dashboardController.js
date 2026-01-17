const { pool } = require('../config/database');

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // Get total leads
        const [totalLeadsResult] = await pool.query('SELECT COUNT(*) as count FROM leads');
        const totalLeads = totalLeadsResult[0].count;

        // Get won leads this month for revenue calculation
        const [wonLeadsResult] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE stage = 'Won' 
            AND MONTH(updated_at) = MONTH(CURDATE())
            AND YEAR(updated_at) = YEAR(CURDATE())
        `);
        const wonLeadsThisMonth = wonLeadsResult[0].count;

        // Calculate revenue (assuming average deal size of $8,500)
        const avgDealSize = 8500;
        const revenue = wonLeadsThisMonth * avgDealSize;

        // Get conversion rate
        const [conversionResult] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won
            FROM leads
        `);
        const conversionRate = conversionResult[0].total > 0 
            ? ((conversionResult[0].won / conversionResult[0].total) * 100).toFixed(1)
            : 0;

        // Get active deals (not Won or Lost)
        const [activeDealsResult] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE stage NOT IN ('Won', 'Lost')
        `);
        const activeDeals = activeDealsResult[0].count;

        // Get pipeline stage counts
        const [pipelineResult] = await pool.query(`
            SELECT 
                stage,
                COUNT(*) as count
            FROM leads
            GROUP BY stage
        `);

        // Map stages with colors
        const stageColorMap = {
            'New': { bgColor: 'bg-slate-50', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
            'Incoming': { bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
            'Contacted': { bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
            'Qualified': { bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
            'Proposal': { bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
            'Second Wing': { bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
            'Won': { bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
            'Lost': { bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' }
        };

        const allStages = ['New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost'];
        const pipelineStages = allStages.map(stageName => {
            const stageData = pipelineResult.find(s => s.stage === stageName);
            return {
                name: stageName,
                stage: stageName,
                count: stageData ? stageData.count : 0,
                ...stageColorMap[stageName]
            };
        });

        // Get recent leads count (last 7 days)
        const [recentLeadsResult] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        const recentLeadsCount = recentLeadsResult[0].count;

        // Get lost leads this month
        const [lostLeadsResult] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE stage = 'Lost' 
            AND MONTH(updated_at) = MONTH(CURDATE())
            AND YEAR(updated_at) = YEAR(CURDATE())
        `);
        const lostLeadsThisMonth = lostLeadsResult[0].count;

        res.json({
            success: true,
            data: {
                totalLeads,
                revenue,
                conversionRate: parseFloat(conversionRate),
                activeDeals,
                pipelineStages,
                recentLeadsCount,
                wonLeadsThisMonth,
                lostLeadsThisMonth
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error.message
        });
    }
};

/**
 * Get KPIs for dashboard cards
 */
exports.getKPIs = async (req, res) => {
    try {
        // Get current month stats
        const [currentMonthStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won_leads,
                SUM(CASE WHEN stage NOT IN ('Won', 'Lost') THEN 1 ELSE 0 END) as active_deals
            FROM leads
            WHERE MONTH(created_at) = MONTH(CURDATE())
            AND YEAR(created_at) = YEAR(CURDATE())
        `);

        // Get previous month stats for comparison
        const [previousMonthStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won_leads,
                SUM(CASE WHEN stage NOT IN ('Won', 'Lost') THEN 1 ELSE 0 END) as active_deals
            FROM leads
            WHERE MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
            AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        `);

        const current = currentMonthStats[0];
        const previous = previousMonthStats[0];

        // Calculate changes
        const leadsChange = previous.total_leads > 0 
            ? (((current.total_leads - previous.total_leads) / previous.total_leads) * 100).toFixed(1)
            : 0;

        const avgDealSize = 8500;
        const currentRevenue = current.won_leads * avgDealSize;
        const previousRevenue = previous.won_leads * avgDealSize;
        const revenueChange = previousRevenue > 0 
            ? (((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)
            : 0;

        // Get overall conversion rate
        const [conversionStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won
            FROM leads
        `);
        const conversionRate = conversionStats[0].total > 0 
            ? ((conversionStats[0].won / conversionStats[0].total) * 100).toFixed(1)
            : 0;

        // Get previous period conversion rate
        const [prevConversionStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won
            FROM leads
            WHERE created_at < DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
        `);
        const prevConversionRate = prevConversionStats[0].total > 0 
            ? ((prevConversionStats[0].won / prevConversionStats[0].total) * 100)
            : 0;
        const conversionChange = prevConversionRate > 0 
            ? (((parseFloat(conversionRate) - prevConversionRate) / prevConversionRate) * 100).toFixed(1)
            : 0;

        const dealsChange = previous.active_deals > 0 
            ? (((current.active_deals - previous.active_deals) / previous.active_deals) * 100).toFixed(1)
            : 0;

        // Get total leads count
        const [totalLeadsResult] = await pool.query('SELECT COUNT(*) as count FROM leads');

        const kpis = [
            {
                title: 'Total Leads',
                value: totalLeadsResult[0].count.toString(),
                change: `${leadsChange >= 0 ? '+' : ''}${leadsChange}%`,
                trend: leadsChange >= 0 ? 'up' : 'down'
            },
            {
                title: 'Revenue',
                value: `$${(currentRevenue / 1000).toFixed(1)}k`,
                change: `${revenueChange >= 0 ? '+' : ''}${revenueChange}%`,
                trend: revenueChange >= 0 ? 'up' : 'down'
            },
            {
                title: 'Conversion Rate',
                value: `${conversionRate}%`,
                change: `${conversionChange >= 0 ? '+' : ''}${conversionChange}%`,
                trend: conversionChange >= 0 ? 'up' : 'down'
            },
            {
                title: 'Active Deals',
                value: current.active_deals.toString(),
                change: `${dealsChange >= 0 ? '+' : ''}${dealsChange}%`,
                trend: dealsChange >= 0 ? 'up' : 'down'
            }
        ];

        res.json({
            success: true,
            data: kpis
        });
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch KPIs',
            error: error.message
        });
    }
};

/**
 * Get pipeline overview for dashboard
 */
exports.getPipelineOverview = async (req, res) => {
    try {
        const [pipelineResult] = await pool.query(`
            SELECT 
                stage,
                COUNT(*) as count
            FROM leads
            GROUP BY stage
        `);

        const stageColorMap = {
            'New': { bgColor: 'bg-slate-50', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
            'Incoming': { bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
            'Contacted': { bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
            'Qualified': { bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
            'Proposal': { bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
            'Second Wing': { bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
            'Won': { bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
            'Lost': { bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' }
        };

        const allStages = ['New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing'];
        const pipelineStages = allStages.map(stageName => {
            const stageData = pipelineResult.find(s => s.stage === stageName);
            return {
                name: stageName,
                stage: stageName,
                count: stageData ? stageData.count : 0,
                ...stageColorMap[stageName]
            };
        });

        res.json({
            success: true,
            data: pipelineStages
        });
    } catch (error) {
        console.error('Error fetching pipeline overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pipeline overview',
            error: error.message
        });
    }
};

/**
 * Get upcoming tasks for dashboard
 */
exports.getUpcomingTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 5;

        const [tasks] = await pool.query(`
            SELECT 
                t.id,
                t.title,
                t.description,
                t.due_date,
                t.priority,
                t.status,
                t.lead_id,
                l.name as lead_name,
                t.created_at,
                t.updated_at
            FROM tasks t
            LEFT JOIN leads l ON t.lead_id = l.id
            WHERE t.user_id = ? 
            AND t.status IN ('Pending', 'In Progress')
            AND (t.due_date IS NULL OR t.due_date >= CURDATE())
            ORDER BY 
                CASE 
                    WHEN t.due_date IS NULL THEN 1 
                    ELSE 0 
                END,
                t.due_date ASC,
                CASE t.priority 
                    WHEN 'High' THEN 1 
                    WHEN 'Medium' THEN 2 
                    WHEN 'Low' THEN 3 
                END
            LIMIT ?
        `, [userId, limit]);

        // Format tasks for frontend
        const formattedTasks = tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            dueDate: task.due_date ? task.due_date.toISOString().split('T')[0] : null,
            priority: task.priority,
            status: task.status,
            leadId: task.lead_id,
            leadName: task.lead_name || 'No Lead'
        }));

        res.json({
            success: true,
            data: formattedTasks
        });
    } catch (error) {
        console.error('Error fetching upcoming tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming tasks',
            error: error.message
        });
    }
};


