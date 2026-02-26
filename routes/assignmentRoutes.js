const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Team = require('../models/Team');
const Case = require('../models/Case');
const { authMiddleware } = require('../middleware/auth');

// GET /api/assignment/officers - Get available officers for assignment
router.get('/officers', authMiddleware, async (req, res) => {
    try {
        const { specialization, availableOnly } = req.query;
        
        const filter = { 
            role: { $in: ['OFFICER', 'ADMIN'] },
            status: 'ACTIVE'
        };
        
        // Filter by specialization if provided
        if (specialization) {
            // This would require adding specialization to User model
            // For now, we'll return all active officers
        }
        
        // Filter by availability (no assigned cases or low caseload)
        if (availableOnly === 'true') {
            const officersWithCases = await Case.aggregate([
                { $match: { status: { $in: ['NEW', 'IN_PROGRESS', 'UNDER_INVESTIGATION'] } } },
                { $group: { _id: '$assignedOfficer', caseCount: { $sum: 1 } } },
                { $match: { caseCount: { $gte: 5 } } }
            ]);
            
            const busyOfficerIds = officersWithCases.map(o => o._id);
            filter._id = { $nin: busyOfficerIds };
        }
        
        const officers = await User.find(filter)
            .select('name email phone role')
            .sort({ name: 1 });
        
        res.json(officers);
    } catch (error) {
        console.error('Error fetching officers:', error);
        res.status(500).json({ message: 'Error fetching officers', error: error.message });
    }
});

// GET /api/assignment/teams - Get available teams for assignment
router.get('/teams', authMiddleware, async (req, res) => {
    try {
        const { specialization } = req.query;
        
        const filter = { isActive: true };
        if (specialization) {
            filter.specialization = specialization;
        }
        
        const teams = await Team.find(filter)
            .populate('members.officer', 'name email')
            .sort({ name: 1 });
        
        res.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ message: 'Error fetching teams', error: error.message });
    }
});

// POST /api/assignment/auto-assign - Automatic case assignment
router.post('/auto-assign', authMiddleware, async (req, res) => {
    try {
        const { caseId, assignmentType = 'OFFICER', specialization } = req.body;
        
        const case_ = await Case.findOne({ caseId });
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }
        
        if (case_.assignedOfficer || case_.assignedTeam) {
            return res.status(400).json({ message: 'Case already assigned' });
        }
        
        let assignedTo = null;
        
        if (assignmentType === 'OFFICER') {
            // Find best officer based on workload and specialization
            const officers = await User.find({
                role: { $in: ['OFFICER', 'ADMIN'] },
                status: 'ACTIVE'
            });
            
            // Get current caseload for each officer
            const officerWorkloads = await Promise.all(
                officers.map(async (officer) => {
                    const caseCount = await Case.countDocuments({
                        assignedOfficer: officer._id,
                        status: { $in: ['NEW', 'IN_PROGRESS', 'UNDER_INVESTIGATION'] }
                    });
                    return {
                        officer: officer._id,
                        name: officer.name,
                        caseCount
                    };
                })
            );
            
            // Sort by caseload (ascending) and assign to officer with lowest workload
            officerWorkloads.sort((a, b) => a.caseCount - b.caseCount);
            const bestOfficer = officerWorkloads[0];
            
            if (bestOfficer) {
                case_.assignedOfficer = bestOfficer.officer;
                assignedTo = bestOfficer;
            }
        } else if (assignmentType === 'TEAM') {
            // Find best team based on specialization matching threat type
            const threatTypeToSpecialization = {
                'POACHING': 'POACHING',
                'FOREST_FIRE': 'FOREST_FIRE',
                'INJURED_ANIMAL': 'WILDLIFE_RESCUE',
                'ILLEGAL_LOGGING': 'POACHING',
                'HUMAN_WILDLIFE_CONFLICT': 'GENERAL'
            };
            
            const requiredSpecialization = specialization || 
                threatTypeToSpecialization[case_.threatType] || 'GENERAL';
            
            const team = await Team.findOne({
                specialization: requiredSpecialization,
                isActive: true
            }).populate('members.officer', 'name email');
            
            if (team) {
                case_.assignedTeam = team._id;
                assignedTo = team;
            }
        }
        
        if (!assignedTo) {
            return res.status(404).json({ message: 'No suitable officer or team found for assignment' });
        }
        
        case_.status = 'IN_PROGRESS';
        
        // Add assignment notification
        const recipientId = assignedTo.officer || assignedTo.members?.[0]?.officer;
        if (recipientId) {
            case_.notifications.push({
                recipient: recipientId,
                type: 'CASE_ASSIGNED',
                message: `Case ${case_.caseId} has been automatically assigned to you`,
                sentAt: new Date()
            });
        }
        
        await case_.save();
        
        res.json({
            message: 'Case assigned successfully',
            case: case_,
            assignedTo
        });
    } catch (error) {
        console.error('Error in auto-assignment:', error);
        res.status(500).json({ message: 'Error in auto-assignment', error: error.message });
    }
});

// POST /api/assignment/bulk-assign - Bulk assignment of multiple cases
router.post('/bulk-assign', authMiddleware, async (req, res) => {
    try {
        const { caseIds, officerId, teamId, assignmentNotes } = req.body;
        
        if (!caseIds || caseIds.length === 0) {
            return res.status(400).json({ message: 'No cases provided for assignment' });
        }
        
        if (!officerId && !teamId) {
            return res.status(400).json({ message: 'Either officerId or teamId must be provided' });
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
        
        const results = [];
        
        for (const caseId of caseIds) {
            try {
                const case_ = await Case.findOne({ caseId });
                
                if (!case_) {
                    results.push({ caseId, success: false, error: 'Case not found' });
                    continue;
                }
                
                case_.assignedOfficer = officerId || case_.assignedOfficer;
                case_.assignedTeam = teamId || case_.assignedTeam;
                case_.status = 'IN_PROGRESS';
                
                // Add assignment notification
                if (officerId) {
                    case_.notifications.push({
                        recipient: officerId,
                        type: 'CASE_ASSIGNED',
                        message: `Case ${case_.caseId} has been assigned to you${assignmentNotes ? ': ' + assignmentNotes : ''}`,
                        sentAt: new Date()
                    });
                }
                
                await case_.save();
                results.push({ caseId, success: true });
            } catch (error) {
                results.push({ caseId, success: false, error: error.message });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        res.json({
            message: `Bulk assignment completed. ${successCount} cases assigned, ${failureCount} failed.`,
            results
        });
    } catch (error) {
        console.error('Error in bulk assignment:', error);
        res.status(500).json({ message: 'Error in bulk assignment', error: error.message });
    }
});

// GET /api/assignment/workload - Get officer workload statistics
router.get('/workload', authMiddleware, async (req, res) => {
    try {
        const workload = await Case.aggregate([
            {
                $match: {
                    assignedOfficer: { $exists: true },
                    status: { $in: ['NEW', 'IN_PROGRESS', 'UNDER_INVESTIGATION'] }
                }
            },
            {
                $group: {
                    _id: '$assignedOfficer',
                    activeCases: { $sum: 1 },
                    highPriorityCases: {
                        $sum: { $cond: [{ $eq: ['$priority', 'HIGH'] }, 1, 0] }
                    },
                    criticalCases: {
                        $sum: { $cond: [{ $eq: ['$priority', 'CRITICAL'] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'officer'
                }
            },
            {
                $unwind: '$officer'
            },
            {
                $project: {
                    officerName: '$officer.name',
                    officerEmail: '$officer.email',
                    activeCases: 1,
                    highPriorityCases: 1,
                    criticalCases: 1,
                    totalPriorityCases: { $add: ['$highPriorityCases', '$criticalCases'] }
                }
            },
            {
                $sort: { activeCases: -1 }
            }
        ]);
        
        res.json(workload);
    } catch (error) {
        console.error('Error fetching workload:', error);
        res.status(500).json({ message: 'Error fetching workload', error: error.message });
    }
});

// GET /api/assignment/recommendations - Get assignment recommendations for a case
router.get('/recommendations/:caseId', authMiddleware, async (req, res) => {
    try {
        const case_ = await Case.findOne({ caseId: req.params.caseId });
        
        if (!case_) {
            return res.status(404).json({ message: 'Case not found' });
        }
        
        // Get officer recommendations based on workload and expertise
        const officers = await User.find({
            role: { $in: ['OFFICER', 'ADMIN'] },
            status: 'ACTIVE'
        });
        
        const officerRecommendations = await Promise.all(
            officers.map(async (officer) => {
                const caseCount = await Case.countDocuments({
                    assignedOfficer: officer._id,
                    status: { $in: ['NEW', 'IN_PROGRESS', 'UNDER_INVESTIGATION'] }
                });
                
                // Calculate recommendation score (lower caseload = higher score)
                const workloadScore = Math.max(0, 10 - caseCount);
                
                return {
                    officerId: officer._id,
                    name: officer.name,
                    email: officer.email,
                    currentCaseload: caseCount,
                    recommendationScore: workloadScore
                };
            })
        );
        
        // Sort by recommendation score
        officerRecommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
        
        // Get team recommendations
        const threatTypeToSpecialization = {
            'POACHING': 'POACHING',
            'FOREST_FIRE': 'FOREST_FIRE',
            'INJURED_ANIMAL': 'WILDLIFE_RESCUE',
            'ILLEGAL_LOGGING': 'POACHING',
            'HUMAN_WILDLIFE_CONFLICT': 'GENERAL'
        };
        
        const requiredSpecialization = threatTypeToSpecialization[case_.threatType] || 'GENERAL';
        
        const teams = await Team.find({
            specialization: requiredSpecialization,
            isActive: true
        }).populate('members.officer', 'name email');
        
        const teamRecommendations = teams.map(team => ({
            teamId: team._id,
            name: team.name,
            specialization: team.specialization,
            memberCount: team.members.length,
            recommendationScore: team.members.length > 0 ? 8 : 5 // Teams with members get higher score
        }));
        
        res.json({
            officers: officerRecommendations.slice(0, 5), // Top 5 officers
            teams: teamRecommendations
        });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({ message: 'Error getting recommendations', error: error.message });
    }
});

module.exports = router;
