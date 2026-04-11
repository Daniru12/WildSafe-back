const AwarenessContent = require('../models/awareness/AwarenessContent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const AWARENESS_GUIDELINE_LIMIT = 2;

const DEFAULT_AWARENESS_BY_TYPE = {
    fire: [
        {
            title: 'Fire Evacuation Basics',
            content: 'Move to a safe open area away from smoke. Follow ranger and emergency unit instructions. Do not return until officials clear the area.',
            category: 'fire-safety'
        },
        {
            title: 'Protect Wildlife During Fire',
            content: 'Avoid entering habitat zones during active fire response. Report trapped wildlife to officers and keep access roads clear for rescue teams.',
            category: 'fire-safety'
        }
    ],
    poaching: [
        {
            title: 'Report Poaching Safely',
            content: 'Do not confront suspects directly. Record location, time, and visible details, then report immediately through official WildSafe channels.',
            category: 'poaching'
        },
        {
            title: 'Preserve Evidence at Scene',
            content: 'Keep distance from traps, shells, footprints, or carcasses. Avoid touching items and wait for authorized officers to process the scene.',
            category: 'poaching'
        }
    ],
    'illegal-logging': [
        {
            title: 'Illegal Logging Response',
            content: 'Do not engage loggers directly. Share exact coordinates, vehicle details, and route information with enforcement teams as quickly as possible.',
            category: 'general'
        },
        {
            title: 'Protect Forest Access Routes',
            content: 'Keep ranger access routes open and avoid moving equipment or cut timber at the location until officials document the area.',
            category: 'general'
        }
    ],
    weather: [
        {
            title: 'Severe Weather Safety Steps',
            content: 'Move to safe shelter, avoid flood-prone streams and trees during storms, and follow official advisories before resuming field movement.',
            category: 'general'
        },
        {
            title: 'Post-Weather Area Check',
            content: 'Inspect trails for fallen trees, erosion, and blocked routes. Report hazards quickly to prevent secondary incidents.',
            category: 'general'
        }
    ],
    general: [
        {
            title: 'Emergency First Actions',
            content: 'Stay calm, move to safe ground, share your live location if possible, and wait for instructions from authorized officers.',
            category: 'general'
        },
        {
            title: 'Community Safety Coordination',
            content: 'Use verified channels for updates, avoid rumor sharing, and prioritize vulnerable people during emergency response.',
            category: 'general'
        }
    ]
};

function dedupeAwareness(items = []) {
    const seen = new Set();
    return items.filter((item) => {
        const id = item?._id?.toString?.() || item?._id || item?.id;
        const contentKey = `${(item?.title || '').trim().toLowerCase()}|${(item?.content || '').trim().toLowerCase()}`;
        const key = id || contentKey;

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function limitAwareness(items = []) {
    return items.slice(0, AWARENESS_GUIDELINE_LIMIT);
}

async function ensureDefaultAwarenessForType(alertType) {
    const templates = DEFAULT_AWARENESS_BY_TYPE[alertType] || [];

    if (templates.length === 0) {
        return;
    }

    await Promise.all(
        templates.map((template) =>
            AwarenessContent.findOneAndUpdate(
                {
                    title: template.title,
                    triggers: alertType
                },
                {
                    $setOnInsert: {
                        title: template.title,
                        content: template.content,
                        category: template.category,
                        triggers: [alertType],
                        isActive: true
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )
        )
    );
}

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

        let items = await AwarenessContent.find({
            triggers: alertType,
            isActive: true
        })
            .populate('createdBy', 'name role')
            .sort({ createdAt: -1 });

        items = limitAwareness(dedupeAwareness(items));

        if (items.length === 0) {
            await ensureDefaultAwarenessForType(alertType);
            items = await AwarenessContent.find({
                triggers: alertType,
                isActive: true
            })
                .populate('createdBy', 'name role')
                .sort({ createdAt: -1 });
            items = limitAwareness(dedupeAwareness(items));
        }

        if (items.length === 0 && alertType !== 'general') {
            await ensureDefaultAwarenessForType('general');
            items = await AwarenessContent.find({
                triggers: 'general',
                isActive: true
            })
                .populate('createdBy', 'name role')
                .sort({ createdAt: -1 });
            items = limitAwareness(dedupeAwareness(items));
        }

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
