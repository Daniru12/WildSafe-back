const Incident = require('../models/Incident');
const { analyzeIncidentPatterns, analyzeIncidentDeep } = require('../integrations/ai/openai');

// Complexity score by category (used as a quick reference)
const COMPLEXITY = {
    'FOREST_FIRE': 9,
    'POACHING': 8,
    'ANIMAL_CONFLICT': 7,
    'ILLEGAL_LOGGING': 6,
    'TRAPPED_INJURED_ANIMAL': 5,
    'OTHER': 4
};

// ── Helper: compute a simple risk level from last-7-day count ──────────────

function getRiskLevel(last7Count) {
    if (last7Count > 15) return 'CRITICAL';
    if (last7Count > 10) return 'HIGH';
    if (last7Count > 5) return 'MEDIUM';
    return 'LOW';
}

// ── Helper: build basic stats from an array of incidents ──────────────────

function buildStats(incidents) {
    const stats = {
        totalIncidents: incidents.length,
        dailyAverage: (incidents.length / 30).toFixed(1),
        categoryBreakdown: {},
        statusBreakdown: {},
        priorityBreakdown: {}
    };

    incidents.forEach(i => {
        stats.categoryBreakdown[i.category] = (stats.categoryBreakdown[i.category] || 0) + 1;
        stats.statusBreakdown[i.status] = (stats.statusBreakdown[i.status] || 0) + 1;
        if (i.priority) {
            stats.priorityBreakdown[i.priority] = (stats.priorityBreakdown[i.priority] || 0) + 1;
        }
    });

    return stats;
}

// ── Helper: compute average resolution time in hours ──────────────────────

function getAvgResolutionHours(incidents) {
    const resolved = incidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status));
    if (resolved.length === 0) return null;

    const totalMs = resolved.reduce((sum, i) =>
        sum + (new Date(i.updatedAt) - new Date(i.createdAt)), 0
    );

    return Math.round(totalMs / resolved.length / (1000 * 60 * 60));
}

// ── Controller 1: Predictive Insights (last 30 days) ──────────────────────
// GET /api/analytics/predictive/insights

exports.getPredictiveInsights = async (req, res) => {
    try {
        // Fetch last 30 days of incidents
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const incidents = await Incident.find({
            createdAt: { $gte: thirtyDaysAgo }
        }).sort({ createdAt: -1 });

        // Build stats
        const stats = buildStats(incidents);

        // Count last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const last7 = incidents.filter(i => new Date(i.createdAt) >= sevenDaysAgo);

        // Simple statistical forecast (always available, even without AI)
        const forecast = {
            next7DaysEstimate: Math.ceil(last7.length * 1.1),
            trend: last7.length > incidents.length / 4 ? 'INCREASING' : 'STABLE',
            confidence: incidents.length >= 10 ? 'HIGH' : incidents.length >= 5 ? 'MEDIUM' : 'LOW'
        };

        // AI analysis (only if we have enough data)
        let aiAnalysis = null;
        if (incidents.length >= 5) {
            try {
                aiAnalysis = await analyzeIncidentPatterns(incidents, stats);
            } catch (err) {
                console.error('AI analysis failed:', err.message);
            }
        }

        res.json({
            stats,
            forecast,
            riskLevel: getRiskLevel(last7.length),
            aiAnalysis,           // Rich JSON from OpenAI, or null if unavailable
            lastUpdated: new Date().toISOString()
        });

    } catch (err) {
        console.error('getPredictiveInsights error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── Controller 2: Deep Prediction for a Single Incident ───────────────────
// GET /api/analytics/predictive/incident/:id

exports.getIncidentPrediction = async (req, res) => {
    try {
        // Find the incident
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        // Find similar past incidents (same category, last 90 days)
        const similarIncidents = await Incident.find({
            category: incident.category,
            _id: { $ne: incident._id },
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 }).limit(15);

        const avgResolutionHours = getAvgResolutionHours(similarIncidents);
        const resolvedCount = similarIncidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status)).length;

        // AI deep analysis
        let aiDeepAnalysis = null;
        try {
            aiDeepAnalysis = await analyzeIncidentDeep(incident, similarIncidents, avgResolutionHours);
        } catch (err) {
            console.error('AI deep analysis failed:', err.message);
        }

        res.json({
            incidentId: incident._id,
            category: incident.category,
            complexityScore: COMPLEXITY[incident.category] || 5,
            similarCasesCount: similarIncidents.length,
            resolvedCasesCount: resolvedCount,
            avgResolutionHours,
            confidence: similarIncidents.length >= 5 ? 'HIGH'
                : similarIncidents.length >= 2 ? 'MEDIUM' : 'LOW',
            aiDeepAnalysis,       // Rich JSON from OpenAI, or null if unavailable
            generatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('getIncidentPrediction error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── Controller 3: Prediction based on ALL incidents ever ──────────────────
// GET /api/analytics/predictive/all

exports.getAllIncidentsPrediction = async (req, res) => {
    try {
        // Fetch every incident in the database, newest first
        const incidents = await Incident.find().sort({ createdAt: -1 });

        if (incidents.length === 0) {
            return res.status(404).json({ message: 'No incidents found in the database.' });
        }

        // Build stats across all incidents
        const stats = buildStats(incidents);

        // Override dailyAverage — calculate based on full date range
        if (incidents.length > 1) {
            const oldest = new Date(incidents[incidents.length - 1].createdAt);
            const newest = new Date(incidents[0].createdAt);
            const totalDays = Math.max(1, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)));
            stats.dailyAverage = (incidents.length / totalDays).toFixed(1);
            stats.dateRangeDays = totalDays;
        }

        // AI analysis on all incidents
        let aiAnalysis = null;
        try {
            aiAnalysis = await analyzeIncidentPatterns(incidents, stats);
        } catch (err) {
            console.error('AI full analysis failed:', err.message);
        }

        res.json({
            totalIncidents: incidents.length,
            stats,
            aiAnalysis,           // Rich AI prediction, or null if API fails
            generatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('getAllIncidentsPrediction error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = {
    getPredictiveInsights: exports.getPredictiveInsights,
    getIncidentPrediction: exports.getIncidentPrediction,
    getAllIncidentsPrediction: exports.getAllIncidentsPrediction
};
