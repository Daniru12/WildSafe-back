const Incident = require('../models/Incident');
const { analyzeIncidentPatterns } = require('../integrations/ai/openai');

// @desc    Get predictive insights for incidents
// @route   GET /api/analytics/predictive/insights
// @access  Private (Officer/Admin)
exports.getPredictiveInsights = async (req, res) => {
    try {
        // Get last 30 days of incidents for analysis
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentIncidents = await Incident.find({
            createdAt: { $gte: thirtyDaysAgo }
        }).sort({ createdAt: -1 });

        // Get AI analysis if we have enough data
        let aiAnalysis = null;
        if (recentIncidents.length >= 5) {
            try {
                aiAnalysis = await analyzeIncidentPatterns(recentIncidents);
            } catch (err) {
                console.error('AI Analysis failed:', err);
            }
        }

        // Generate basic statistics
        const stats = {
            totalIncidents: recentIncidents.length,
            categoryBreakdown: {},
            statusBreakdown: {},
            dailyAverage: (recentIncidents.length / 30).toFixed(1)
        };

        recentIncidents.forEach(incident => {
            // Category breakdown
            stats.categoryBreakdown[incident.category] = 
                (stats.categoryBreakdown[incident.category] || 0) + 1;
            
            // Status breakdown
            stats.statusBreakdown[incident.status] = 
                (stats.statusBreakdown[incident.status] || 0) + 1;
        });

        // Generate simple forecast based on trends
        const lastWeekIncidents = recentIncidents.filter(i => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(i.createdAt) >= weekAgo;
        });

        const forecast = {
            next7Days: Math.ceil(lastWeekIncidents.length * 1.1), // 10% increase assumption
            trend: lastWeekIncidents.length > recentIncidents.length / 4 ? 'INCREASING' : 'STABLE',
            confidence: recentIncidents.length >= 10 ? 'HIGH' : recentIncidents.length >= 5 ? 'MEDIUM' : 'LOW'
        };

        // Determine risk level
        let riskLevel = 'LOW';
        if (lastWeekIncidents.length > 10) riskLevel = 'HIGH';
        else if (lastWeekIncidents.length > 5) riskLevel = 'MEDIUM';
        else if (lastWeekIncidents.length > 15) riskLevel = 'CRITICAL';

        const insights = {
            currentStats: stats,
            forecast,
            riskLevel,
            aiAnalysis,
            lastUpdated: new Date().toISOString()
        };

        res.json(insights);
    } catch (err) {
        console.error('Predictive Insights Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get incident prediction for specific incident
// @route   GET /api/analytics/predictive/incident/:id
// @access  Private (Officer/Admin)
exports.getIncidentPrediction = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        // Find similar historical incidents
        const similarIncidents = await Incident.find({
            category: incident.category,
            _id: { $ne: incident._id },
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
        }).sort({ createdAt: -1 }).limit(10);

        // Calculate average resolution time for similar incidents
        const resolvedIncidents = similarIncidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED');
        let avgResolutionTime = null;
        
        if (resolvedIncidents.length > 0) {
            const totalTime = resolvedIncidents.reduce((sum, inc) => {
                const created = new Date(inc.createdAt);
                const updated = new Date(inc.updatedAt);
                return sum + (updated - created);
            }, 0);
            avgResolutionTime = Math.round(totalTime / resolvedIncidents.length / (1000 * 60 * 60)); // in hours
        }

        // Determine complexity based on category and historical data
        const complexityScores = {
            'FOREST_FIRE': 9,
            'POACHING': 8,
            'ANIMAL_CONFLICT': 7,
            'ILLEGAL_LOGGING': 6,
            'TRAPPED_INJURED_ANIMAL': 5,
            'OTHER': 4
        };

        const prediction = {
            incidentId: incident._id,
            category: incident.category,
            complexityScore: complexityScores[incident.category] || 5,
            estimatedResolutionTime: avgResolutionTime,
            similarCasesCount: similarIncidents.length,
            similarResolvedCases: resolvedIncidents.length,
            recommendedPriority: incident.priority,
            confidence: similarIncidents.length >= 5 ? 'HIGH' : similarIncidents.length >= 2 ? 'MEDIUM' : 'LOW'
        };

        res.json(prediction);
    } catch (err) {
        console.error('Incident Prediction Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = {
    getPredictiveInsights: exports.getPredictiveInsights,
    getIncidentPrediction: exports.getIncidentPrediction
};
