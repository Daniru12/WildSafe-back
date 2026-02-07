const Incident = require('../models/Incident');

// @desc    Get incidents count by category
// @route   GET /api/analytics/incidents-by-category
// @access  Private (Officer/Admin)
exports.getIncidentsByCategory = async (req, res) => {
    try {
        const stats = await Incident.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $project: { category: '$_id', count: 1, _id: 0 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get incidents count by status
// @route   GET /api/analytics/incidents-by-status
// @access  Private (Officer/Admin)
exports.getIncidentsByStatus = async (req, res) => {
    try {
        const stats = await Incident.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { status: '$_id', count: 1, _id: 0 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get monthly incident trends
// @route   GET /api/analytics/trends
// @access  Private (Officer/Admin)
exports.getIncidentTrends = async (req, res) => {
    try {
        const stats = await Incident.aggregate([
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
