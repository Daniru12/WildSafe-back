const Staff = require('../../models/resourceStaff/Staff');
const User = require('../../models/User');

const createStaff = async (req, res) => {
    try {
        const { userId, department, permissions } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const existing = await Staff.findOne({ userId });
        if (existing) return res.status(400).json({ message: 'Staff already assigned' });

        const staff = await Staff.create({ userId, department, permissions });

        // Automatically promote user role to OFFICER
        await User.findByIdAndUpdate(userId, { role: 'OFFICER' });

        res.status(201).json(staff);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const listStaff = async (req, res) => {
    try {
        const staff = await Staff.find().populate('userId', '-password');
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const getStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id).populate('userId', '-password');
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const updateStaff = async (req, res) => {
    try {
        const updates = req.body;
        const staff = await Staff.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('userId', '-password');
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findByIdAndDelete(req.params.id);
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
        res.json({ message: 'Staff removed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = { createStaff, listStaff, getStaff, updateStaff, deleteStaff };
