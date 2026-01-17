const { pool } = require('../config/database');

/**
 * Get revenue and leads trend over time
 */
exports.getRevenueTrend = async (req, res) => {
    try {
        const { months = 6 } = req.query;
        
        const query = `
            SELECT 
                DATE_FORMAT(created_at, '%b') as month,
                DATE_FORMAT(created_at, '%Y-%m') as month_key,
                COUNT(*) as leads,
                COUNT(CASE WHEN stage = 'Won' THEN 1 END) as won_leads
            FROM leads
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
            GROUP BY month_key, month
            ORDER BY month_key ASC
        `;

        const [results] = await pool.query(query, [parseInt(months)]);
        
        // Calculate estimated revenue (assuming average deal size)
        const avgDealSize = 8500; // This could be configurable
        const trendData = results.map(row => ({
            month: row.month,
            leads: row.leads,
            revenue: row.won_leads * avgDealSize
        }));

        res.json({
            success: true,
            data: trendData
        });
    } catch (error) {
        console.error('Error fetching revenue trend:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue trend',
            error: error.message
        });
    }
};

/**
 * Get conversion funnel data
 */
exports.getConversionFunnel = async (req, res) => {
    try {
        const query = `
            SELECT 
                stage,
                COUNT(*) as value
            FROM leads
            WHERE stage IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won')
            GROUP BY stage
            ORDER BY FIELD(stage, 'New', 'Contacted', 'Qualified', 'Proposal', 'Won')
        `;

        const [results] = await pool.query(query);
        
        // Map stage names to more user-friendly names
        const stageNameMap = {
            'New': 'New Leads',
            'Contacted': 'Contacted',
            'Qualified': 'Qualified',
            'Proposal': 'Proposal',
            'Won': 'Closed Won'
        };

        const colorMap = {
            'New': '#64748b',
            'Contacted': '#3b82f6',
            'Qualified': '#10b981',
            'Proposal': '#6366f1',
            'Won': '#059669'
        };

        const funnelData = results.map(row => ({
            name: stageNameMap[row.stage] || row.stage,
            value: row.value,
            color: colorMap[row.stage] || '#64748b'
        }));

        res.json({
            success: true,
            data: funnelData
        });
    } catch (error) {
        console.error('Error fetching conversion funnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversion funnel',
            error: error.message
        });
    }
};

/**
 * Get performance metrics
 */
exports.getPerformanceMetrics = async (req, res) => {
    try {
        // Get various metrics
        const metricsQuery = `
            SELECT 
                COUNT(*) as total_leads,
                COUNT(CASE WHEN stage = 'Won' THEN 1 END) as won_leads,
                COUNT(CASE WHEN stage = 'Lost' THEN 1 END) as lost_leads,
                AVG(DATEDIFF(updated_at, created_at)) as avg_sales_cycle
            FROM leads
        `;

        const [metrics] = await pool.query(metricsQuery);
        const data = metrics[0];

        // Calculate conversion rate
        const conversionRate = data.total_leads > 0 
            ? ((data.won_leads / data.total_leads) * 100).toFixed(1)
            : 0;

        // Calculate average deal size (this would ideally come from a deals/revenue table)
        const avgDealSize = 8500;

        // Calculate sales cycle in days
        const salesCycle = Math.round(data.avg_sales_cycle || 45);

        // Mock customer satisfaction (this would come from a feedback table)
        const customerSatisfaction = '4.2/5';

        const performanceData = [
            {
                metric: 'Lead Conversion',
                value: `${conversionRate}%`,
                target: '25%',
                progress: Math.min(Math.round((parseFloat(conversionRate) / 25) * 100), 100)
            },
            {
                metric: 'Avg Deal Size',
                value: `$${avgDealSize.toLocaleString()}`,
                target: '$10,000',
                progress: Math.round((avgDealSize / 10000) * 100)
            },
            {
                metric: 'Sales Cycle',
                value: `${salesCycle} days`,
                target: '40 days',
                progress: Math.max(Math.round((40 / salesCycle) * 100), 0)
            },
            {
                metric: 'Customer Satisfaction',
                value: customerSatisfaction,
                target: '4.5/5',
                progress: Math.round((4.2 / 4.5) * 100)
            }
        ];

        res.json({
            success: true,
            data: performanceData
        });
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch performance metrics',
            error: error.message
        });
    }
};

/**
 * Get pipeline distribution (for pie chart)
 */
exports.getPipelineDistribution = async (req, res) => {
    try {
        const query = `
            SELECT 
                stage,
                COUNT(*) as value
            FROM leads
            GROUP BY stage
            ORDER BY value DESC
        `;

        const [results] = await pool.query(query);

        const colorMap = {
            'New': '#64748b',
            'Incoming': '#94a3b8',
            'Contacted': '#3b82f6',
            'Qualified': '#10b981',
            'Proposal': '#6366f1',
            'Second Wing': '#8b5cf6',
            'Won': '#059669',
            'Lost': '#ef4444'
        };

        const distributionData = results.map(row => ({
            name: row.stage,
            value: row.value,
            color: colorMap[row.stage] || '#64748b'
        }));

        res.json({
            success: true,
            data: distributionData
        });
    } catch (error) {
        console.error('Error fetching pipeline distribution:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pipeline distribution',
            error: error.message
        });
    }
};

/**
 * Get all analytics data in one call (overview)
 */
exports.getOverview = async (req, res) => {
    try {
        const { months = 6 } = req.query;

        // Execute all queries in parallel
        const [revenueTrend, conversionFunnel, performanceMetrics, pipelineDistribution] = await Promise.all([
            getRevenueTrendData(months),
            getConversionFunnelData(),
            getPerformanceMetricsData(),
            getPipelineDistributionData()
        ]);

        res.json({
            success: true,
            data: {
                revenueTrend,
                conversionFunnel,
                performanceMetrics,
                pipelineDistribution
            }
        });
    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics overview',
            error: error.message
        });
    }
};

// Helper functions for getOverview
async function getRevenueTrendData(months) {
    const query = `
        SELECT 
            DATE_FORMAT(created_at, '%b') as month,
            DATE_FORMAT(created_at, '%Y-%m') as month_key,
            COUNT(*) as leads,
            COUNT(CASE WHEN stage = 'Won' THEN 1 END) as won_leads
        FROM leads
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY month_key, month
        ORDER BY month_key ASC
    `;

    const [results] = await pool.query(query, [parseInt(months)]);
    const avgDealSize = 8500;
    
    return results.map(row => ({
        month: row.month,
        leads: row.leads,
        revenue: row.won_leads * avgDealSize
    }));
}

async function getConversionFunnelData() {
    const query = `
        SELECT 
            stage,
            COUNT(*) as value
        FROM leads
        WHERE stage IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won')
        GROUP BY stage
        ORDER BY FIELD(stage, 'New', 'Contacted', 'Qualified', 'Proposal', 'Won')
    `;

    const [results] = await pool.query(query);
    
    const stageNameMap = {
        'New': 'New Leads',
        'Contacted': 'Contacted',
        'Qualified': 'Qualified',
        'Proposal': 'Proposal',
        'Won': 'Closed Won'
    };

    const colorMap = {
        'New': '#64748b',
        'Contacted': '#3b82f6',
        'Qualified': '#10b981',
        'Proposal': '#6366f1',
        'Won': '#059669'
    };

    return results.map(row => ({
        name: stageNameMap[row.stage] || row.stage,
        value: row.value,
        color: colorMap[row.stage] || '#64748b'
    }));
}

async function getPerformanceMetricsData() {
    const metricsQuery = `
        SELECT 
            COUNT(*) as total_leads,
            COUNT(CASE WHEN stage = 'Won' THEN 1 END) as won_leads,
            COUNT(CASE WHEN stage = 'Lost' THEN 1 END) as lost_leads,
            AVG(DATEDIFF(updated_at, created_at)) as avg_sales_cycle
        FROM leads
    `;

    const [metrics] = await pool.query(metricsQuery);
    const data = metrics[0];

    const conversionRate = data.total_leads > 0 
        ? ((data.won_leads / data.total_leads) * 100).toFixed(1)
        : 0;

    const avgDealSize = 8500;
    const salesCycle = Math.round(data.avg_sales_cycle || 45);
    const customerSatisfaction = '4.2/5';

    return [
        {
            metric: 'Lead Conversion',
            value: `${conversionRate}%`,
            target: '25%',
            progress: Math.min(Math.round((parseFloat(conversionRate) / 25) * 100), 100)
        },
        {
            metric: 'Avg Deal Size',
            value: `$${avgDealSize.toLocaleString()}`,
            target: '$10,000',
            progress: Math.round((avgDealSize / 10000) * 100)
        },
        {
            metric: 'Sales Cycle',
            value: `${salesCycle} days`,
            target: '40 days',
            progress: Math.max(Math.round((40 / salesCycle) * 100), 0)
        },
        {
            metric: 'Customer Satisfaction',
            value: customerSatisfaction,
            target: '4.5/5',
            progress: Math.round((4.2 / 4.5) * 100)
        }
    ];
}

async function getPipelineDistributionData() {
    const query = `
        SELECT 
            stage,
            COUNT(*) as value
        FROM leads
        GROUP BY stage
        ORDER BY value DESC
    `;

    const [results] = await pool.query(query);

    const colorMap = {
        'New': '#64748b',
        'Incoming': '#94a3b8',
        'Contacted': '#3b82f6',
        'Qualified': '#10b981',
        'Proposal': '#6366f1',
        'Second Wing': '#8b5cf6',
        'Won': '#059669',
        'Lost': '#ef4444'
    };

    return results.map(row => ({
        name: row.stage,
        value: row.value,
        color: colorMap[row.stage] || '#64748b'
    }));
}
