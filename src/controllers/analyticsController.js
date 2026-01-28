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
 * Get revenue and leads trend over time
 */
exports.getRevenueTrend = async (req, res) => {
    try {
        const { months = 6 } = req.query;
        const trendData = await getRevenueTrendData(months);

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
 * Get conversion funnel data (Now Passenger Distribution)
 */
exports.getConversionFunnel = async (req, res) => {
    try {
        const funnelData = await getConversionFunnelData();

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
        const performanceData = await getPerformanceMetricsData();

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
 * Get pipeline distribution (Now Location Distribution)
 */
exports.getPipelineDistribution = async (req, res) => {
    try {
        const distributionData = await getPipelineDistributionData();

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

        // Fetch all bookings once to avoid multiple database calls
        const bookingsSnapshot = await db.collection('bookings').get();
        const bookings = [];
        bookingsSnapshot.forEach(doc => {
            bookings.push({ id: doc.id, ...doc.data() });
        });

        const [revenueTrend, conversionFunnel, performanceMetrics, pipelineDistribution] = await Promise.all([
            calculateRevenueTrend(bookings, months),
            calculatePassengerDistribution(bookings),
            calculatePerformanceMetrics(bookings),
            calculateLocationDistribution(bookings)
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

// --- Internal Calculation Functions ---

async function getRevenueTrendData(months) {
    const snapshot = await db.collection('bookings').get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));
    return calculateRevenueTrend(bookings, months);
}

function calculateRevenueTrend(bookings, months) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendMap = {};

    // Initialize required months
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trendMap[yearMonth] = {
            month: monthNames[d.getMonth()],
            revenue: 0,
            leads: 0
        };
    }

    bookings.forEach(b => {
        const date = normalizeDate(b.created_at || b.createdAt);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trendMap[yearMonth]) {
            trendMap[yearMonth].leads++;
            // Estimate revenue based on passengers and distance/hours if available
            // Simple logic: $50 per booking base + $20 per passenger
            const passengers = parseInt(b.numberOfPassengers) || 1;
            const estimate = 50 + (passengers * 20);
            trendMap[yearMonth].revenue += estimate;
        }
    });

    return Object.values(trendMap);
}

async function getConversionFunnelData() {
    const snapshot = await db.collection('bookings').get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));
    return calculatePassengerDistribution(bookings);
}

function calculatePassengerDistribution(bookings) {
    const passDist = {
        '1-2 Pass': 0,
        '3-4 Pass': 0,
        '5-7 Pass': 0,
        '8+ Pass': 0
    };

    bookings.forEach(b => {
        const p = parseInt(b.numberOfPassengers) || 0;
        if (p <= 2) passDist['1-2 Pass']++;
        else if (p <= 4) passDist['3-4 Pass']++;
        else if (p <= 7) passDist['5-7 Pass']++;
        else passDist['8+ Pass']++;
    });

    const colors = ['#059669', '#10b981', '#34d399', '#6ee7b7'];
    return Object.entries(passDist).map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
    }));
}

async function getPerformanceMetricsData() {
    const snapshot = await db.collection('bookings').get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));
    return calculatePerformanceMetrics(bookings);
}

function calculatePerformanceMetrics(bookings) {
    const totalBookings = bookings.length;
    const totalPassengers = bookings.reduce((sum, b) => sum + (parseInt(b.numberOfPassengers) || 0), 0);
    const avgPassengers = totalBookings > 0 ? (totalPassengers / totalBookings).toFixed(1) : 0;
    const uniqueClients = new Set(bookings.map(b => b.email).filter(Boolean)).size;

    return [
        {
            metric: 'Total Bookings',
            value: totalBookings.toString(),
            target: '100',
            progress: Math.min(Math.round((totalBookings / 100) * 100), 100)
        },
        {
            metric: 'Total Passengers',
            value: totalPassengers.toString(),
            target: '500',
            progress: Math.min(Math.round((totalPassengers / 500) * 100), 100)
        },
        {
            metric: 'Avg Passengers',
            value: `${avgPassengers}`,
            target: '4.0',
            progress: Math.min(Math.round((parseFloat(avgPassengers) / 4.0) * 100), 100)
        },
        {
            metric: 'Unique Clients',
            value: uniqueClients.toString(),
            target: '50',
            progress: Math.min(Math.round((uniqueClients / 50) * 100), 100)
        }
    ];
}

async function getPipelineDistributionData() {
    const snapshot = await db.collection('bookings').get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));
    return calculateLocationDistribution(bookings);
}

function calculateLocationDistribution(bookings) {
    const locationMap = {};
    bookings.forEach(b => {
        let loc = b.pickupLocation || 'Other';
        // Try to extract city or main part of address
        let parts = loc.split(',');
        let city = parts.length > 1 ? parts[parts.length - 2].trim() : parts[0].trim();
        if (city.length > 20) city = city.substring(0, 17) + '...';

        locationMap[city] = (locationMap[city] || 0) + 1;
    });

    const colors = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];
    return Object.entries(locationMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length]
        }));
}

