const Case = require('../models/Case');
const ThreatReport = require('../models/ThreatReport');
const RangerMission = require('../models/RangerMission');

/**
 * GET /api/ranger/cases - My assigned cases (create RangerMission if missing)
 * Query: rangerStatus (filter), page, limit
 */
const getMyAssignedCases = async (req, res) => {
    try {
        const { rangerStatus, page = 1, limit = 10 } = req.query;
        const userId = req.user.id;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));

        const caseFilter = { assignedOfficer: userId };

        let caseIds;
        if (rangerStatus) {
            const missions = await RangerMission.find({
                assignedTo: userId,
                rangerStatus
            })
                .select('caseId')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean();
            caseIds = missions.map((m) => m.caseId);
            if (caseIds.length === 0) {
                return res.json({
                    cases: [],
                    pagination: { current: parseInt(page, 10), pages: 0, total: 0 }
                });
            }
        }

        const cases = await Case.find(
            caseIds ? { caseId: { $in: caseIds } } : caseFilter
        )
            .populate('threatReportId', 'description media reportId')
            .sort({ createdAt: -1 })
            .limit(caseIds ? caseIds.length : limitNum)
            .skip(caseIds ? 0 : skip)
            .lean();

        const caseMap = new Map(cases.map((c) => [c.caseId, c]));
        const orderIds = caseIds || cases.map((c) => c.caseId);

        const result = [];
        for (const id of orderIds) {
            const c = caseMap.get(id);
            if (!c) continue;

            let mission = await RangerMission.findOne({ caseId: c.caseId });
            if (!mission) {
                mission = await RangerMission.create({
                    caseId: c.caseId,
                    assignedTo: userId,
                    rangerStatus: 'ASSIGNED',
                    rangerStatusHistory: [{ status: 'ASSIGNED', changedAt: new Date() }]
                });
            }

            const threatReport = c.threatReportId || {};
            result.push({
                caseId: c.caseId,
                threatType: c.threatType,
                location: c.location,
                priority: c.priority,
                status: c.status,
                description: threatReport.description,
                media: threatReport.media,
                rangerStatus: mission.rangerStatus,
                rangerStatusHistory: mission.rangerStatusHistory,
                createdAt: c.createdAt
            });
        }

        let total;
        if (rangerStatus) {
            total = await RangerMission.countDocuments({ assignedTo: userId, rangerStatus });
        } else {
            total = await Case.countDocuments(caseFilter);
        }

        res.json({
            cases: result,
            pagination: {
                current: parseInt(page, 10),
                pages: Math.ceil(total / limitNum),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching ranger assigned cases:', error);
        res.status(500).json({ message: 'Error fetching assigned cases', error: error.message });
    }
};

/**
 * POST /api/ranger/cases/:caseId/accept - Accept mission
 */
const acceptMission = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc) {
            return res.status(404).json({ message: 'Case not found' });
        }
        if (caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case is not assigned to you' });
        }

        const mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            return res.status(404).json({ message: 'Ranger mission not found' });
        }
        if (mission.rangerStatus !== 'ASSIGNED') {
            return res.status(400).json({ message: 'Mission can only be accepted when status is ASSIGNED' });
        }

        const missionUpdated = await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId, rangerStatus: 'ASSIGNED' },
            {
                $set: { rangerStatus: 'ACCEPTED', updatedAt: new Date() },
                $push: {
                    rangerStatusHistory: {
                        status: 'ACCEPTED',
                        changedAt: new Date(),
                        changedBy: userId
                    }
                }
            },
            { new: true }
        );

        if (!missionUpdated) {
            return res.status(400).json({ message: 'Could not update mission' });
        }

        res.json({
            message: 'Mission accepted',
            caseId,
            rangerStatus: missionUpdated.rangerStatus
        });
    } catch (error) {
        console.error('Error accepting mission:', error);
        res.status(500).json({ message: 'Error accepting mission', error: error.message });
    }
};

/**
 * POST /api/ranger/cases/:caseId/decline - Decline mission (unassigns case for Case Management)
 */
const declineMission = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { declineReason } = req.body || {};
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc) {
            return res.status(404).json({ message: 'Case not found' });
        }
        if (caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case is not assigned to you' });
        }

        const mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            return res.status(404).json({ message: 'Ranger mission not found' });
        }
        if (mission.rangerStatus !== 'ASSIGNED') {
            return res.status(400).json({ message: 'Mission can only be declined when status is ASSIGNED' });
        }

        await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId },
            {
                $set: {
                    rangerStatus: 'DECLINED',
                    declineReason: declineReason || '',
                    updatedAt: new Date()
                },
                $push: {
                    rangerStatusHistory: {
                        status: 'DECLINED',
                        changedAt: new Date(),
                        changedBy: userId,
                        notes: declineReason
                    }
                }
            }
        );

        caseDoc.assignedOfficer = undefined;
        await caseDoc.save();

        res.json({
            message: 'Mission declined; case is unassigned for reassignment',
            caseId
        });
    } catch (error) {
        console.error('Error declining mission:', error);
        res.status(500).json({ message: 'Error declining mission', error: error.message });
    }
};

module.exports = {
    getMyAssignedCases,
    acceptMission,
    declineMission
};
