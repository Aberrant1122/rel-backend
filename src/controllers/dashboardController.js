const { pool } = require('../config/database');
const { db } = require('../config/firebase');

/**
 * Normalizes different date formats from Firebase
 */
const normalizeDate = (value) => {
    if (!value) return new Date();
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value._seconds) return new Date(value._seconds * 1000);
    if (typeof value === 'number') return new Date(value);
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
};

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const snapshot = await db.collection('bookings').get();
        const bookings = [];
        snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

        const totalBookings = bookings.length;

        // Calculate estimated revenue
        const revenue = bookings.reduce((sum, b) => {
            const passengers = parseInt(b.numberOfPassengers) || 1;
            return sum + (50 + (passengers * 20)); // Same estimate logic as analytics
        }, 0);

        const uniqueClients = new Set(bookings.map(b => b.email).filter(Boolean)).size;

        // Recent bookings (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentBookingsCount = bookings.filter(b => normalizeDate(b.created_at || b.createdAt) >= sevenDaysAgo).length;

        res.json({
            success: true,
            data: {
                totalLeads: totalBookings, // Keep key for frontend compatibility
                revenue,
                conversionRate: 100, // No pipeline, so 100% conversion to "lead"
                activeDeals: totalBookings,
                pipelineStages: [], // Removed as requested
                recentLeadsCount: recentBookingsCount,
                uniqueClients
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
        const snapshot = await db.collection('bookings').get();
        const bookings = [];
        snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonth = prevMonthDate.getMonth();
        const prevYear = prevMonthDate.getFullYear();

        const currentMonthBookings = bookings.filter(b => {
            const d = normalizeDate(b.created_at || b.createdAt);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const prevMonthBookings = bookings.filter(b => {
            const d = normalizeDate(b.created_at || b.createdAt);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const calculateRevenue = (list) => list.reduce((sum, b) => {
            const p = parseInt(b.numberOfPassengers) || 1;
            return sum + (50 + (p * 20));
        }, 0);

        const currRevenue = calculateRevenue(currentMonthBookings);
        const prevRevenue = calculateRevenue(prevMonthBookings);

        const leadsChange = prevMonthBookings.length > 0
            ? (((currentMonthBookings.length - prevMonthBookings.length) / prevMonthBookings.length) * 100).toFixed(1)
            : 0;

        const venueChange = prevRevenue > 0
            ? (((currRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
            : 0;

        const kpis = [
            {
                title: 'Total Bookings',
                value: bookings.length.toString(),
                change: `${leadsChange >= 0 ? '+' : ''}${leadsChange}%`,
                trend: leadsChange >= 0 ? 'up' : 'down'
            },
            {
                title: 'Est. Revenue',
                value: `$${(currRevenue / 1000).toFixed(1)}k`,
                change: `${venueChange >= 0 ? '+' : ''}${venueChange}%`,
                trend: venueChange >= 0 ? 'up' : 'down'
            },
            {
                title: 'Total Clients',
                value: new Set(bookings.map(b => b.email).filter(Boolean)).size.toString(),
                change: 'New',
                trend: 'up'
            },
            {
                title: 'Monthly Bookings',
                value: currentMonthBookings.length.toString(),
                change: `${leadsChange >= 0 ? '+' : ''}${leadsChange}%`,
                trend: leadsChange >= 0 ? 'up' : 'down'
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
 * Get pipeline overview (Redundant now, but keeping for compatibility)
 */
exports.getPipelineOverview = async (req, res) => {
    res.json({
        success: true,
        data: []
    });
};

/**
 * Get upcoming tasks for dashboard
 */
exports.getUpcomingTasks = async (req, res) => {
    try {
        const userId = req.user?.id || 1; // Fallback if no user context
        const limit = parseInt(req.query.limit) || 5;

        // Note: Tasks are still in MySQL
        const [tasks] = await pool.query(`
            SELECT 
                t.id,
                t.title,
                t.description,
                t.due_date,
                t.priority,
                t.status,
                t.lead_id,
                t.created_at,
                t.updated_at
            FROM tasks t
            WHERE t.user_id = ? 
            AND t.status IN ('Pending', 'In Progress')
            AND (t.due_date IS NULL OR t.due_date >= CURDATE())
            ORDER BY 
                CASE 
                    WHEN t.due_date IS NULL THEN 1 
                    ELSE 0 
                END,
                t.due_date ASC
            LIMIT ?
        `, [userId, limit]);

        const formattedTasks = tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            dueDate: task.due_date ? task.due_date.toISOString().split('T')[0] : null,
            priority: task.priority,
            status: task.status,
            leadId: task.lead_id,
            leadName: 'Customer' // Simplified
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



