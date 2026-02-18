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
        const resources = await Resource.find(filter).populate('assignedTo');
        res.json(resources);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id).populate('assignedTo');
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

        const staff = await Staff.findById(staffId);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });

        resource.assignedTo = staff._id;
        resource.status = 'ASSIGNED';
        await resource.save();

        res.json(resource);
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
