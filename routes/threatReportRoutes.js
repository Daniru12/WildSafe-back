const express = require('express');
const router = express.Router();
const ThreatReport = require('../models/ThreatReport');
const Case = require('../models/Case');
const { authMiddleware } = require('../middleware/auth');

// Generate unique report ID
const generateReportId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TR-${timestamp}-${random}`.toUpperCase();
};

// POST /api/threat-reports - Submit a new threat report
router.post('/', async (req, res) => {
    try {
        const {
            threatType,
            location,
            dateTime,
            description,
            reporterInfo,
            media,
            urgencyLevel
        } = req.body;

        // Validate required fields
        if (!threatType || !location || !dateTime || !description || !reporterInfo) {
            return res.status(400).json({ 
                message: 'Missing required fields: threatType, location, dateTime, description, reporterInfo' 
            });
        }

        // Validate location data
        if (!location.lat || !location.lng || !location.address) {
            return res.status(400).json({ 
                message: 'Invalid location data. lat, lng, and address are required' 
            });
        }

        // Create threat report
        const threatReport = new ThreatReport({
            reportId: generateReportId(),
            threatType,
            location,
            dateTime: new Date(dateTime),
            description,
            reporterInfo,
            media: media || [],
            urgencyLevel: urgencyLevel || 'MEDIUM'
        });

        await threatReport.save();

        res.status(201).json({
            message: 'Threat report submitted successfully',
            reportId: threatReport.reportId,
            status: threatReport.status
        });
    } catch (error) {
        console.error('Error submitting threat report:', error);
        res.status(500).json({ message: 'Error submitting threat report', error: error.message });
    }
});

// GET /api/threat-reports - Get all threat reports (admin/officer only)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, threatType, page = 1, limit = 10 } = req.query;
        const filter = {};
        
        if (status) filter.status = status;
        if (threatType) filter.threatType = threatType;

        const reports = await ThreatReport.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await ThreatReport.countDocuments(filter);

        res.json({
            reports,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching threat reports:', error);
        res.status(500).json({ message: 'Error fetching threat reports', error: error.message });
    }
});

// GET /api/threat-reports/:reportId - Get specific threat report
router.get('/:reportId', authMiddleware, async (req, res) => {
    try {
        const report = await ThreatReport.findOne({ reportId: req.params.reportId });
        
        if (!report) {
            return res.status(404).json({ message: 'Threat report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error fetching threat report:', error);
        res.status(500).json({ message: 'Error fetching threat report', error: error.message });
    }
});

// PUT /api/threat-reports/:reportId/validate - Validate threat report (admin/officer only)
router.put('/:reportId/validate', authMiddleware, async (req, res) => {
    try {
        const { status, validationNotes } = req.body;
        
        if (!['VALIDATED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Must be VALIDATED or REJECTED' });
        }

        const report = await ThreatReport.findOneAndUpdate(
            { reportId: req.params.reportId },
            { 
                status,
                validationNotes,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ message: 'Threat report not found' });
        }

        // If validated, create a case
        if (status === 'VALIDATED') {
            const Case = require('../models/Case');
            const generateCaseId = () => {
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substr(2, 5);
                return `CS-${timestamp}-${random}`.toUpperCase();
            };

            const newCase = new Case({
                caseId: generateCaseId(),
                threatReportId: report._id,
                threatType: report.threatType,
                location: report.location,
                reporterInfo: report.reporterInfo,
                dateTime: report.dateTime,
                priority: report.urgencyLevel
            });

            await newCase.save();
        }

        res.json({
            message: `Threat report ${status.toLowerCase()} successfully`,
            report
        });
    } catch (error) {
        console.error('Error validating threat report:', error);
        res.status(500).json({ message: 'Error validating threat report', error: error.message });
    }
});

// GET /api/threat-reports/stats - Get threat report statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
    try {
        const stats = await ThreatReport.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const threatTypeStats = await ThreatReport.aggregate([
            {
                $group: {
                    _id: '$threatType',
                    count: { $sum: 1 }
                }
            }
        ]);

        const urgencyStats = await ThreatReport.aggregate([
            {
                $group: {
                    _id: '$urgencyLevel',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            statusBreakdown: stats,
            threatTypeBreakdown: threatTypeStats,
            urgencyBreakdown: urgencyStats
        });
    } catch (error) {
        console.error('Error fetching threat report stats:', error);
        res.status(500).json({ message: 'Error fetching threat report stats', error: error.message });
    }
});

module.exports = router;
