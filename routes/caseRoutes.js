const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const ThreatReport = require('../models/ThreatReport');
const User = require('../models/User');
const Team = require('../models/Team');
const { authMiddleware } = require('../middleware/auth');

// Generate unique case ID
const generateCaseId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CS-${timestamp}-${random}`.toUpperCase();
};

// GET /api/cases - Get all cases (with filters)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { 
            status, 
            priority, 
            assignedOfficer, 
            threatType,
            page = 1, 
            limit = 10 
        } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (assignedOfficer) filter.assignedOfficer = assignedOfficer;
        if (threatType) filter.threatType = threatType;

        const cases = await Case.find(filter)
            .populate('assignedOfficer', 'name email')
            .populate('assignedTeam', 'name specialization')
            .populate('threatReportId', 'reportId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Case.countDocuments(filter);

        res.json({
            cases,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ message: 'Error fetching cases', error: error.message });
    }
});

// GET /api/cases/:caseId - Get specific case
router.get('/:caseId', authMiddleware, async (req, res) => {
    try {
        const case_ = await Case.findOne({ caseId: req.params.caseId })
            .populate('assignedOfficer', 'name email phone')
            .populate('assignedTeam', 'name specialization members')
            .populate('threatReportId', 'reportId status')
            .populate('investigation.findings.addedBy', 'name')
            .populate('investigation.evidence.uploadedBy', 'name')
            .populate('investigation.actions.takenBy', 'name')
            .populate('resolution.resolvedBy', 'name')
            .populate('notifications.recipient', 'name email');
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }

        res.json(case_);
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ message: 'Error fetching case', error: error.message });
    }
});

// PUT /api/cases/:caseId/assign - Assign case to officer/team
router.put('/:caseId/assign', authMiddleware, async (req, res) => {
    try {
        const { officerId, teamId, assignmentNotes } = req.body;
        
        const case_ = await Case.findOne({ caseId: req.params.caseId });
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }

        // Validate officer/team exists
        if (officerId) {
            const officer = await User.findById(officerId);
            if (!officer || !['OFFICER', 'ADMIN'].includes(officer.role)) {
                return res.status(400).json({ message: 'Invalid officer assignment' });
            }
        }

        if (teamId) {
            const team = await Team.findById(teamId);
            if (!team) {
                return res.status(400).json({ message: 'Invalid team assignment' });
            }
        }

        case_.assignedOfficer = officerId || case_.assignedOfficer;
        case_.assignedTeam = teamId || case_.assignedTeam;
        case_.status = 'IN_PROGRESS';
        
        // Add notification
        case_.notifications.push({
            recipient: officerId,
            type: 'CASE_ASSIGNED',
            message: `Case ${case_.caseId} has been assigned to you${assignmentNotes ? ': ' + assignmentNotes : ''}`,
            sentAt: new Date()
        });

        await case_.save();

        res.json({
            message: 'Case assigned successfully',
            case: case_
        });
    } catch (error) {
        console.error('Error assigning case:', error);
        res.status(500).json({ message: 'Error assigning case', error: error.message });
    }
});

// PUT /api/cases/:caseId/investigation - Add investigation findings
router.put('/:caseId/investigation', authMiddleware, async (req, res) => {
    try {
        const { findings, evidence, actions } = req.body;
        
        const case_ = await Case.findOne({ caseId: req.params.caseId });
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }

        if (findings) {
            case_.investigation.findings.push({
                type: findings.type,
                description: findings.description,
                addedBy: req.user.id,
                addedAt: new Date()
            });
        }

        if (evidence) {
            case_.investigation.evidence.push({
                type: evidence.type,
                url: evidence.url,
                description: evidence.description,
                uploadedBy: req.user.id,
                uploadedAt: new Date()
            });
        }

        if (actions) {
            case_.investigation.actions.push({
                action: actions.action,
                takenBy: req.user.id,
                takenAt: new Date(),
                result: actions.result
            });
        }

        case_.status = 'UNDER_INVESTIGATION';
        case_.updatedAt = new Date();

        await case_.save();

        res.json({
            message: 'Investigation updated successfully',
            case: case_
        });
    } catch (error) {
        console.error('Error updating investigation:', error);
        res.status(500).json({ message: 'Error updating investigation', error: error.message });
    }
});

// PUT /api/cases/:caseId/resolve - Resolve case
router.put('/:caseId/resolve', authMiddleware, async (req, res) => {
    try {
        const { actionSummary, outcome } = req.body;
        
        const case_ = await Case.findOne({ caseId: req.params.caseId });
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }

        case_.resolution = {
            actionSummary,
            outcome,
            resolvedAt: new Date(),
            resolvedBy: req.user.id
        };

        case_.status = 'RESOLVED';
        case_.updatedAt = new Date();

        // Add resolution notification
        case_.notifications.push({
            recipient: case_.assignedOfficer,
            type: 'RESOLUTION',
            message: `Case ${case_.caseId} has been resolved`,
            sentAt: new Date()
        });

        await case_.save();

        res.json({
            message: 'Case resolved successfully',
            case: case_
        });
    } catch (error) {
        console.error('Error resolving case:', error);
        res.status(500).json({ message: 'Error resolving case', error: error.message });
    }
});

// PUT /api/cases/:caseId/close - Close case (admin only)
router.put('/:caseId/close', authMiddleware, async (req, res) => {
    try {
        const case_ = await Case.findOne({ caseId: req.params.caseId });
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }

        if (case_.status !== 'RESOLVED') {
            return res.status(400).json({ message: 'Only resolved cases can be closed' });
        }

        case_.status = 'CLOSED';
        case_.updatedAt = new Date();

        await case_.save();

        res.json({
            message: 'Case closed successfully',
            case: case_
        });
    } catch (error) {
        console.error('Error closing case:', error);
        res.status(500).json({ message: 'Error closing case', error: error.message });
    }
});

// GET /api/cases/stats/overview - Get case statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
    try {
        const statusStats = await Case.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityStats = await Case.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);

        const threatTypeStats = await Case.aggregate([
            {
                $group: {
                    _id: '$threatType',
                    count: { $sum: 1 }
                }
            }
        ]);

        const resolutionTime = await Case.aggregate([
            {
                $match: {
                    'resolution.resolvedAt': { $exists: true }
                }
            },
            {
                $project: {
                    resolutionDays: {
                        $divide: [
                            { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTime: { $avg: '$resolutionDays' },
                    minResolutionTime: { $min: '$resolutionDays' },
                    maxResolutionTime: { $max: '$resolutionDays' }
                }
            }
        ]);

        res.json({
            statusBreakdown: statusStats,
            priorityBreakdown: priorityStats,
            threatTypeBreakdown: threatTypeStats,
            resolutionTime: resolutionTime[0] || null
        });
    } catch (error) {
        console.error('Error fetching case stats:', error);
        res.status(500).json({ message: 'Error fetching case stats', error: error.message });
    }
});

// GET /api/cases/assigned/:officerId - Get cases assigned to specific officer
router.get('/assigned/:officerId', authMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        const filter = { assignedOfficer: req.params.officerId };
        if (status) filter.status = status;

        const cases = await Case.find(filter)
            .populate('assignedTeam', 'name specialization')
            .populate('threatReportId', 'reportId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Case.countDocuments(filter);

        res.json({
            cases,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching assigned cases:', error);
        res.status(500).json({ message: 'Error fetching assigned cases', error: error.message });
    }
});

module.exports = router;
