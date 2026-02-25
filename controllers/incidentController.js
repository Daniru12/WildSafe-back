const Incident = require('../models/Incident');
const { createNotification, notifyByRole } = require('./notificationController');

// @desc    Create a new incident report
// @route   POST /api/incidents
// @access  Private (Citizen)
exports.createIncident = async (req, res) => {
    try {
        const { title, description, category, location } = req.body;
        
        // Parse location if it's a string
        let parsedLocation;
        if (typeof location === 'string') {
            try {
                parsedLocation = JSON.parse(location);
            } catch (parseError) {
                return res.status(400).json({ message: 'Invalid location format' });
            }
        } else {
            parsedLocation = location;
        }
        
        // Validate required location fields
        if (!parsedLocation || typeof parsedLocation.lat !== 'number' || typeof parsedLocation.lng !== 'number') {
            return res.status(400).json({ message: 'Valid location coordinates are required' });
        }
        
        // Get uploaded image URLs from req.files (if any)
        let photos = [];
        if (req.files && req.files.length > 0) {
            photos = req.files.map(file => file.path); // Cloudinary URLs
        }

        const incident = await Incident.create({
            title,
            description,
            category,
            location: parsedLocation,
            photos,
            reporterId: req.user.id
        });

        // Notify reporter that incident was received
        createNotification(req.user.id, {
            title: 'Incident Report Received',
            message: `Your incident report "${title}" has been submitted successfully and is now under review.`,
            type: 'NEW_INCIDENT',
            priority: 'MEDIUM',
            relatedIncident: incident._id
        }).catch(err => console.error('Notification error (create):', err));

        // Notify officers about the new incident
        notifyByRole(['OFFICER', 'ADMIN'], {
            title: 'New Incident Reported',
            message: `A new ${category} incident "${title}" has been reported and needs attention.`,
            type: 'NEW_INCIDENT',
            priority: incident.priority === 'CRITICAL' ? 'URGENT' : 'HIGH',
            relatedIncident: incident._id
        }).catch(err => console.error('Notification error (officers):', err));

        res.status(201).json(incident);
    } catch (err) {
        console.error('Error creating incident:', err);
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

        // Build a user-friendly status message
        const statusMessages = {
            UNDER_REVIEW: 'Your incident report is now under review by our team.',
            IN_PROGRESS: 'Your incident is now being actively handled.',
            RESOLVED: 'Your incident has been resolved. Thank you for reporting.',
            CLOSED: 'Your incident has been closed.'
        };

        // Notify the reporter about the status change
        if (incident.reporterId) {
            createNotification(incident.reporterId, {
                title: `Incident ${status.replace('_', ' ')}`,
                message: statusMessages[status] || `Your incident "${incident.title}" status changed to ${status}.`,
                type: 'INCIDENT_UPDATE',
                priority: (status === 'RESOLVED' || status === 'CLOSED') ? 'LOW' : 'MEDIUM',
                relatedIncident: incident._id
            }).catch(err => console.error('Notification error (status):', err));
        }

        // If assigned officer exists, notify them too
        if (incident.assignedTo) {
            createNotification(incident.assignedTo, {
                title: `Incident Status Updated`,
                message: `Incident "${incident.title}" status has been changed to ${status}.`,
                type: 'INCIDENT_UPDATE',
                priority: 'MEDIUM',
                relatedIncident: incident._id
            }).catch(err => console.error('Notification error (officer status):', err));
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

        // Notify the assigned officer
        createNotification(assignedTo, {
            title: 'New Incident Assigned',
            message: `You have been assigned to incident "${incident.title}" (${incident.category}). Please review and take action.`,
            type: 'ASSIGNMENT',
            priority: incident.priority === 'CRITICAL' ? 'URGENT' : 'HIGH',
            relatedIncident: incident._id
        }).catch(err => console.error('Notification error (assign officer):', err));

        // Notify the reporter that an officer has been assigned
        if (incident.reporterId) {
            createNotification(incident.reporterId, {
                title: 'Officer Assigned to Your Incident',
                message: `A responsible officer has been assigned to handle your incident "${incident.title}". We will keep you updated on progress.`,
                type: 'INCIDENT_UPDATE',
                priority: 'MEDIUM',
                relatedIncident: incident._id
            }).catch(err => console.error('Notification error (assign reporter):', err));
        }

        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
