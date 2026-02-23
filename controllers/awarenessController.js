const AwarenessContent = require('../models/awareness/AwarenessContent');
const Notification = require('../models/Notification');
const User = require('../models/User');

// -------------------------------------------------------
// POST /awareness/
// Create new awareness content (ADMIN / OFFICER only)
// -------------------------------------------------------
exports.createAwareness = async (req, res) => {
    try {
        const {
            title,
            content,
            category,
            triggers = [],
            locations = [],
            isActive = true,
            schedule = null
        } = req.body;

        if (!title || !content || !category) {
            return res.status(400).json({ message: 'title, content, and category are required' });
        }

        const awareness = await AwarenessContent.create({
            title,
            content,
            category,
            triggers,
            locations,
            isActive,
            schedule,
            createdBy: req.user.id
        });

        res.status(201).json({ message: 'Awareness content created', awareness });
    } catch (error) {
        console.error('Error creating awareness content:', error);
        res.status(500).json({ message: 'Error creating awareness content', error: error.message });
    }
};

// -------------------------------------------------------
// GET /awareness/active
// List all currently active awareness content
// -------------------------------------------------------
exports.getActiveContent = async (req, res) => {
    try {
        const { category, limit = 50, page = 1 } = req.query;

        const filter = { isActive: true };
        if (category) filter.category = category;

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            AwarenessContent.find(filter)
                .populate('createdBy', 'name role')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip),
            AwarenessContent.countDocuments(filter)
        ]);

        res.json({
            awareness: items,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching active awareness content:', error);
        res.status(500).json({ message: 'Error fetching awareness content', error: error.message });
    }
};

// -------------------------------------------------------
// GET /awareness/relevant/:alertType
// Get awareness content relevant to a specific alert type
// e.g. GET /awareness/relevant/fire
// -------------------------------------------------------
exports.getRelevantAwareness = async (req, res) => {
    try {
        const { alertType } = req.params;

        const validTypes = ['fire', 'poaching', 'illegal-logging', 'weather', 'general'];
        if (!validTypes.includes(alertType)) {
            return res.status(400).json({
                message: `Invalid alertType. Valid values: ${validTypes.join(', ')}`
            });
        }

        const items = await AwarenessContent.find({
            triggers: alertType,
            isActive: true
        })
            .populate('createdBy', 'name role')
            .sort({ createdAt: -1 });

        res.json({ alertType, awareness: items, count: items.length });
    } catch (error) {
        console.error('Error fetching relevant awareness content:', error);
        res.status(500).json({ message: 'Error fetching relevant awareness', error: error.message });
    }
};

// -------------------------------------------------------
// POST /awareness/periodic
// Send scheduled awareness notifications to target users
// Body: { schedule: 'weekly' | 'monthly' | 'daily', targetRoles: ['CITIZEN'] }
// -------------------------------------------------------
exports.sendPeriodicUpdate = async (req, res) => {
    try {
        const { schedule = 'weekly', targetRoles = ['CITIZEN', 'OFFICER', 'ADMIN'] } = req.body;

        const validSchedules = ['daily', 'weekly', 'monthly'];
        if (!validSchedules.includes(schedule)) {
            return res.status(400).json({
                message: `Invalid schedule. Valid values: ${validSchedules.join(', ')}`
            });
        }

        // Find scheduled awareness content
        const contentItems = await AwarenessContent.find({
            schedule,
            isActive: true
        });

        if (contentItems.length === 0) {
            return res.json({ message: `No active ${schedule} awareness content found`, sent: 0 });
        }

        // Find target users
        const users = await User.find({
            role: { $in: targetRoles },
            status: 'ACTIVE'
        }).select('_id');

        if (users.length === 0) {
            return res.json({ message: 'No active target users found', sent: 0 });
        }

        // Build notification records for each user × each content item
        const notifications = [];
        for (const item of contentItems) {
            for (const user of users) {
                notifications.push({
                    userId: user._id,
                    title: `📢 Awareness Update: ${item.title}`,
                    message: item.content.substring(0, 300),
                    type: 'awareness',
                    priority: 'LOW',
                    metadata: {
                        awarenessId: item._id,
                        category: item.category,
                        schedule,
                        autoGenerated: true
                    }
                });
            }
        }

        await Notification.insertMany(notifications);

        res.json({
            message: `Periodic ${schedule} awareness notifications sent`,
            contentItems: contentItems.length,
            recipients: users.length,
            notificationsSent: notifications.length
        });
    } catch (error) {
        console.error('Error sending periodic awareness update:', error);
        res.status(500).json({ message: 'Error sending periodic awareness', error: error.message });
    }
};

// -------------------------------------------------------
// GET /awareness/:id
// Get a single awareness content item by ID
// -------------------------------------------------------
exports.getAwarenessById = async (req, res) => {
    try {
        const item = await AwarenessContent.findById(req.params.id)
            .populate('createdBy', 'name role');

        if (!item) {
            return res.status(404).json({ message: 'Awareness content not found' });
        }

        res.json({ awareness: item });
    } catch (error) {
        console.error('Error fetching awareness by id:', error);
        res.status(500).json({ message: 'Error fetching awareness content', error: error.message });
    }
};

// -------------------------------------------------------
// PATCH /awareness/:id
// Update awareness content
// -------------------------------------------------------
exports.updateAwareness = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Prevent overwriting createdBy
        delete updates.createdBy;

        const item = await AwarenessContent.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

        if (!item) {
            return res.status(404).json({ message: 'Awareness content not found' });
        }

        res.json({ message: 'Awareness content updated', awareness: item });
    } catch (error) {
        console.error('Error updating awareness content:', error);
        res.status(500).json({ message: 'Error updating awareness content', error: error.message });
    }
};

// -------------------------------------------------------
// DELETE /awareness/:id
// Soft-delete awareness content (set isActive = false)
// -------------------------------------------------------
exports.deleteAwareness = async (req, res) => {
    try {
        const item = await AwarenessContent.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({ message: 'Awareness content not found' });
        }

        res.json({ message: 'Awareness content deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating awareness content:', error);
        res.status(500).json({ message: 'Error deactivating awareness content', error: error.message });
    }
};
