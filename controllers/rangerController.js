const mongoose = require('mongoose');
const Case = require('../models/Case');
const ThreatReport = require('../models/ThreatReport');
const RangerMission = require('../models/RangerMission');
const { getSuggestedRangerSteps } = require('./suggestRangerStepsController');

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

// ---------- Case detail, start mission, arrive on site, action taken ----------

/**
 * GET /api/ranger/cases/:caseId - Full case detail for ranger (Case + ThreatReport + RangerMission)
 */
const getCaseDetail = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId })
            .populate('threatReportId')
            .lean();
        if (!caseDoc) {
            return res.status(404).json({ message: 'Case not found' });
        }
        if (caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case is not assigned to you' });
        }

        let mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            mission = await RangerMission.create({
                caseId,
                assignedTo: userId,
                rangerStatus: 'ASSIGNED',
                rangerStatusHistory: [{ status: 'ASSIGNED', changedAt: new Date() }]
            });
        }

        const threatReport = caseDoc.threatReportId || {};
        res.json({
            caseId: caseDoc.caseId,
            threatType: caseDoc.threatType,
            location: caseDoc.location,
            priority: caseDoc.priority,
            status: caseDoc.status,
            dateTime: caseDoc.dateTime,
            reporterInfo: caseDoc.reporterInfo,
            description: threatReport.description,
            media: threatReport.media,
            rangerStatus: mission.rangerStatus,
            rangerStatusHistory: mission.rangerStatusHistory,
            evidence: mission.evidence,
            createdAt: caseDoc.createdAt
        });
    } catch (error) {
        console.error('Error fetching ranger case detail:', error);
        res.status(500).json({ message: 'Error fetching case detail', error: error.message });
    }
};

/**
 * POST /api/ranger/cases/:caseId/start-mission - Set EN_ROUTE (from ACCEPTED)
 */
const startMission = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const updated = await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId, rangerStatus: 'ACCEPTED' },
            {
                $set: { rangerStatus: 'EN_ROUTE', updatedAt: new Date() },
                $push: { rangerStatusHistory: { status: 'EN_ROUTE', changedAt: new Date(), changedBy: userId } }
            },
            { new: true }
        );
        if (!updated) {
            return res.status(400).json({ message: 'Mission can only be started when status is ACCEPTED' });
        }
        res.json({ message: 'Mission started', caseId, rangerStatus: updated.rangerStatus });
    } catch (error) {
        console.error('Error starting mission:', error);
        res.status(500).json({ message: 'Error starting mission', error: error.message });
    }
};

/**
 * POST /api/ranger/cases/:caseId/arrive-on-site - Set ON_SITE (from EN_ROUTE). Body: { notes }
 */
const arriveOnSite = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { notes } = req.body || {};
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const updated = await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId, rangerStatus: 'EN_ROUTE' },
            {
                $set: { rangerStatus: 'ON_SITE', updatedAt: new Date() },
                $push: {
                    rangerStatusHistory: {
                        status: 'ON_SITE',
                        changedAt: new Date(),
                        changedBy: userId,
                        notes: notes || ''
                    }
                }
            },
            { new: true }
        );
        if (!updated) {
            return res.status(400).json({ message: 'Can only arrive on site when status is EN_ROUTE' });
        }
        res.json({ message: 'Arrived on site', caseId, rangerStatus: updated.rangerStatus });
    } catch (error) {
        console.error('Error arriving on site:', error);
        res.status(500).json({ message: 'Error arriving on site', error: error.message });
    }
};

// ---------- Suggested actions (Groq AI or rule-based fallback) ----------

/**
 * GET /api/ranger/cases/:caseId/suggested-actions - Suggested steps for ranger (uses suggestRangerSteps + groq)
 */
const getSuggestedActions = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId }).populate('threatReportId').lean();
        if (!caseDoc) {
            return res.status(404).json({ message: 'Case not found' });
        }
        if (caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case is not assigned to you' });
        }

        const threatType = caseDoc.threatType || 'OTHER';
        const description = (caseDoc.threatReportId && caseDoc.threatReportId.description)
            ? String(caseDoc.threatReportId.description)
            : '';

        const suggestedActions = await getSuggestedRangerSteps(threatType, description);
        res.json({ caseId, suggestedActions });
    } catch (error) {
        console.error('Error fetching suggested actions:', error);
        res.status(500).json({ message: 'Error fetching suggested actions', error: error.message });
    }
};

/**
 * POST /api/ranger/cases/:caseId/action-taken - Set ACTION_TAKEN (from ON_SITE)
 */
const actionTaken = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const updated = await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId, rangerStatus: 'ON_SITE' },
            {
                $set: { rangerStatus: 'ACTION_TAKEN', updatedAt: new Date() },
                $push: { rangerStatusHistory: { status: 'ACTION_TAKEN', changedAt: new Date(), changedBy: userId } }
            },
            { new: true }
        );
        if (!updated) {
            return res.status(400).json({ message: 'Can only mark action taken when status is ON_SITE' });
        }
        res.json({ message: 'Action taken recorded', caseId, rangerStatus: updated.rangerStatus });
    } catch (error) {
        console.error('Error recording action taken:', error);
        res.status(500).json({ message: 'Error recording action taken', error: error.message });
    }
};

// ---------- Evidence upload ----------

/**
 * POST /api/ranger/cases/:caseId/evidence - Upload evidence (photos, notes, condition, GPS). Requires ON_SITE or later.
 * Multipart: files (photos), body: description, notes, conditionSummary, gpsLat, gpsLng (or JSON gps)
 */
const addEvidence = async (req, res) => {
    try {
        const { caseId } = req.params;
        const userId = req.user.id;
        const { description, notes, conditionSummary, gpsLat, gpsLng } = req.body || {};

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            return res.status(404).json({ message: 'Ranger mission not found' });
        }
        const allowed = ['ON_SITE', 'ACTION_TAKEN'];
        if (!allowed.includes(mission.rangerStatus)) {
            return res.status(400).json({
                message: 'Evidence can only be added when status is ON_SITE or ACTION_TAKEN'
            });
        }

        const files = req.files || [];
        const gps =
            gpsLat != null && gpsLng != null
                ? { lat: Number(gpsLat), lng: Number(gpsLng) }
                : undefined;

        const evidenceItems = [];
        for (const f of files) {
            const url = f.filename ? `/uploads/ranger/${f.filename}` : (f.path || f.location || f.url || '');
            evidenceItems.push({
                url: url || `/uploads/ranger/${Date.now()}`,
                evidenceType: (f.mimetype || '').startsWith('video/') ? 'VIDEO' : 'PHOTO',
                description: description || '',
                notes: notes || '',
                conditionSummary: conditionSummary || '',
                gps,
                uploadedAt: new Date(),
                uploadedBy: userId
            });
        }
        if (evidenceItems.length === 0 && (description || notes || conditionSummary)) {
            evidenceItems.push({
                url: 'text-report',
                evidenceType: 'REPORT',
                description: description || '',
                notes: notes || '',
                conditionSummary: conditionSummary || '',
                gps,
                uploadedAt: new Date(),
                uploadedBy: userId
            });
        }

        if (evidenceItems.length === 0) {
            return res.status(400).json({ message: 'Provide at least one photo or description/notes' });
        }

        await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId },
            { $push: { evidence: { $each: evidenceItems } }, $set: { updatedAt: new Date() } }
        );

        const updated = await RangerMission.findOne({ caseId, assignedTo: userId })
            .select('evidence')
            .lean();
        res.json({ message: 'Evidence added', caseId, evidence: updated.evidence });
    } catch (error) {
        console.error('Error adding evidence:', error);
        res.status(500).json({ message: 'Error adding evidence', error: error.message });
    }
};

/**
 * DELETE /api/ranger/cases/:caseId/evidence/:evidenceId - Delete one uploaded evidence item.
 * Ranger must be assigned to the case; status must be ON_SITE or ACTION_TAKEN (not yet closed).
 */
const deleteEvidence = async (req, res) => {
    try {
        const { caseId, evidenceId } = req.params;
        const userId = req.user.id;

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            return res.status(404).json({ message: 'Ranger mission not found' });
        }
        const allowed = ['ON_SITE', 'ACTION_TAKEN'];
        if (!allowed.includes(mission.rangerStatus)) {
            return res.status(400).json({
                message: 'Evidence can only be deleted when status is ON_SITE or ACTION_TAKEN'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(evidenceId)) {
            return res.status(400).json({ message: 'Invalid evidence id' });
        }

        const hasEvidence = mission.evidence.some((e) => e._id && e._id.toString() === evidenceId);
        if (!hasEvidence) {
            return res.status(404).json({ message: 'Evidence not found' });
        }

        await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId },
            { $pull: { evidence: { _id: evidenceId } }, $set: { updatedAt: new Date() } }
        );

        const updated = await RangerMission.findOne({ caseId, assignedTo: userId })
            .select('evidence')
            .lean();
        res.json({ message: 'Evidence deleted', caseId, evidence: updated.evidence });
    } catch (error) {
        console.error('Error deleting evidence:', error);
        res.status(500).json({ message: 'Error deleting evidence', error: error.message });
    }
};

// ---------- Close case ----------

/**
 * POST /api/ranger/cases/:caseId/close - Close case with solution and proof. Syncs to Case for Case Management.
 * Body: actionTaken, solutionProvided, proofUrls (array), dateTime (optional)
 */
const closeCase = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { actionTaken, solutionProvided, proofUrls = [], dateTime } = req.body || {};
        const userId = req.user.id;

        if (!actionTaken || !solutionProvided) {
            return res.status(400).json({ message: 'actionTaken and solutionProvided are required' });
        }

        const caseDoc = await Case.findOne({ caseId });
        if (!caseDoc || caseDoc.assignedOfficer?.toString() !== userId) {
            return res.status(403).json({ message: 'Case not found or not assigned to you' });
        }

        const mission = await RangerMission.findOne({ caseId, assignedTo: userId });
        if (!mission) {
            return res.status(404).json({ message: 'Ranger mission not found' });
        }
        const allowed = ['ON_SITE', 'ACTION_TAKEN'];
        if (!allowed.includes(mission.rangerStatus)) {
            return res.status(400).json({
                message: 'Case can only be closed when status is ON_SITE or ACTION_TAKEN'
            });
        }

        const resolvedAt = dateTime ? new Date(dateTime) : new Date();

        await RangerMission.findOneAndUpdate(
            { caseId, assignedTo: userId },
            {
                $set: {
                    rangerStatus: 'CLOSED',
                    resolution: {
                        actionSummary: actionTaken,
                        outcome: solutionProvided,
                        proofUrls: Array.isArray(proofUrls) ? proofUrls : [],
                        resolvedAt,
                        resolvedBy: userId
                    },
                    updatedAt: new Date()
                },
                $push: {
                    rangerStatusHistory: {
                        status: 'CLOSED',
                        changedAt: new Date(),
                        changedBy: userId
                    }
                }
            }
        );

        caseDoc.resolution = {
            actionSummary: actionTaken,
            outcome: solutionProvided,
            resolvedAt,
            resolvedBy: userId
        };
        caseDoc.status = 'RESOLVED';
        caseDoc.updatedAt = new Date();
        await caseDoc.save();

        res.json({
            message: 'Case closed successfully',
            caseId,
            rangerStatus: 'CLOSED',
            caseStatus: caseDoc.status
        });
    } catch (error) {
        console.error('Error closing case:', error);
        res.status(500).json({ message: 'Error closing case', error: error.message });
    }
};

module.exports = {
    getMyAssignedCases,
    acceptMission,
    declineMission,
    getCaseDetail,
    getSuggestedActions,
    startMission,
    arriveOnSite,
    actionTaken,
    addEvidence,
    deleteEvidence,
    closeCase
};
