const Resource = require('../../models/resourceStaff/Resource');
const Staff = require('../../models/resourceStaff/Staff');

const createResource = async (req, res) => {
    try {
        const { type, description, metadata } = req.body;
        const resource = await Resource.create({ type, description, metadata });
        res.status(201).json(resource);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const listResources = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status.toUpperCase();
        const resources = await Resource.find(filter).populate({
            path: 'assignedTo',
            populate: {
                path: 'userId',
                select: 'name email role'
            }
        });
        res.json(resources);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id).populate({
            path: 'assignedTo',
            populate: {
                path: 'userId',
                select: 'name email role'
            }
        });
        if (!resource) return res.status(404).json({ message: 'Resource not found' });
        res.json(resource);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const assignResource = async (req, res) => {
    try {
        const { staffId } = req.body;

        const resource = await Resource.findById(req.params.id);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        if (resource.status !== 'AVAILABLE') {
            return res.status(409).json({
                message: 'Resource is already in use or unavailable. Release it first.'
            });
        }

        let staff;

        if (req.user?.role === 'OFFICER') {
            // Officers can take resources directly. If their staff profile does not exist yet,
            // create a minimal one so resource ownership is still tracked consistently.
            staff = await Staff.findOne({ userId: req.user._id });
            if (!staff) {
                staff = await Staff.create({ userId: req.user._id, department: 'PATROL', permissions: [] });
            }
        } else {
            if (!staffId) return res.status(400).json({ message: 'staffId is required' });
            staff = await Staff.findById(staffId);
            if (!staff) return res.status(404).json({ message: 'Staff not found' });
        }

        resource.assignedTo = staff._id;
        resource.status = 'ASSIGNED';
        await resource.save();

        const populated = await Resource.findById(resource._id).populate({
            path: 'assignedTo',
            populate: {
                path: 'userId',
                select: 'name email role'
            }
        });

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const updateResource = async (req, res) => {
    try {
        const updates = req.body;
        const resource = await Resource.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!resource) return res.status(404).json({ message: 'Resource not found' });
        res.json(resource);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const archiveResource = async (req, res) => {
    try {
        const resource = await Resource.findByIdAndUpdate(req.params.id, { status: 'ARCHIVED' }, { new: true });
        if (!resource) return res.status(404).json({ message: 'Resource not found' });
        res.json(resource);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = { createResource, listResources, getResource, assignResource, updateResource, archiveResource };
