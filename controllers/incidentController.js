const Incident = require('../models/Incident');

// @desc    Create a new incident report
// @route   POST /api/incidents
// @access  Private (Citizen)
exports.createIncident = async (req, res) => {
    try {
        const { title, description, category, location } = req.body;
        
        // Get uploaded image URLs from req.files (if any)
        let photos = [];
        if (req.files && req.files.length > 0) {
            photos = req.files.map(file => file.path); // Cloudinary URLs
        }

        const incident = await Incident.create({
            title,
            description,
            category,
            location,
            photos,
            reporterId: req.user.id
        });

        res.status(201).json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get all incidents reported by the logged-in user
// @route   GET /api/incidents/mine
// @access  Private (Citizen)
exports.getMyIncidents = async (req, res) => {
    try {
        const incidents = await Incident.find({ reporterId: req.user.id })
            .sort({ createdAt: -1 });
        res.json(incidents);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get incident by ID
// @route   GET /api/incidents/:id
// @access  Private
exports.getIncidentById = async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        // Check if user is the reporter or an officer/admin
        if (incident.reporterId.toString() !== req.user.id && !['OFFICER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Get all incidents (with filters)
// @route   GET /api/incidents
// @access  Private (Officer/Admin)
exports.getAllIncidents = async (req, res) => {
    try {
        const { status, category, priority } = req.query;
        let query = {};

        if (status) query.status = status;
        if (category) query.category = category;
        if (priority) query.priority = priority;

        const incidents = await Incident.find(query)
            .populate('reporterId', 'name email')
            .populate('assignedTo', 'name')
            .sort({ createdAt: -1 });

        res.json(incidents);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Update incident status
// @route   PATCH /api/incidents/:id/status
// @access  Private (Officer/Admin)
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const incident = await Incident.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Assign incident to an officer
// @route   PATCH /api/incidents/:id/assign
// @access  Private (Admin)
exports.assignIncident = async (req, res) => {
    try {
        const { assignedTo, priority } = req.body;
        const update = { assignedTo };
        if (priority) update.priority = priority;

        const incident = await Incident.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        );

        if (!incident) {
            return res.status(404).json({ message: 'Incident not found' });
        }

        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
