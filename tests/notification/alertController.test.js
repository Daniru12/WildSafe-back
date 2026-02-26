// tests/notification/alertController.test.js
// Simple unit tests for the most important alert APIs

jest.mock('../../models/Alert');
jest.mock('../../models/User');
jest.mock('../../services/smartAlertService');

const Alert = require('../../models/Alert');
const User = require('../../models/User');
const SmartAlertService = require('../../services/smartAlertService');

const {
    getAlerts,
    sendEmergencyAlert,
    sendCustomAlert,
    sendAnnouncement,
    deleteAlert,
} = require('../../controllers/alertController');

// ─── helpers ────────────────────────────────────────────────────────────────
const mockReq = (body = {}, params = {}, query = {}, user = { id: 'u1', role: 'OFFICER' }) => ({
    body, params, query, user,
});
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================================
// getAlerts
// ============================================================================
describe('getAlerts', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns paginated alerts for user role', async () => {
        const alerts = [{ _id: 'al1' }, { _id: 'al2' }];
        Alert.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            skip: jest.fn().mockResolvedValue(alerts),
        });
        Alert.countDocuments.mockResolvedValue(2);

        const req = mockReq({}, {}, { limit: '50', page: '1' });
        const res = mockRes();
        await getAlerts(req, res);

        expect(Alert.find).toHaveBeenCalledWith(expect.objectContaining({ targetRoles: 'OFFICER', isActive: true }));
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ alerts, pagination: expect.objectContaining({ total: 2 }) })
        );
    });

    test('500 – returns error on DB failure', async () => {
        Alert.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            skip: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq();
        const res = mockRes();
        await getAlerts(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// sendEmergencyAlert
// ============================================================================
describe('sendEmergencyAlert', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – sends emergency alert', async () => {
        Alert.create.mockResolvedValue({ _id: 'al1', title: 'Fire!', category: 'EMERGENCY' });
        User.countDocuments.mockResolvedValue(5);
        SmartAlertService.handleNewAlert.mockResolvedValue(undefined);

        const req = mockReq({ title: 'Fire!', message: 'Evacuate now' });
        const res = mockRes();
        await sendEmergencyAlert(req, res);

        expect(Alert.create).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'EMERGENCY', priority: 'URGENT' })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('400 – missing title or message', async () => {
        const req = mockReq({ title: 'Only title' });
        const res = mockRes();
        await sendEmergencyAlert(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ============================================================================
// sendCustomAlert
// ============================================================================
describe('sendCustomAlert', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – sends custom alert to specified roles', async () => {
        Alert.create.mockResolvedValue({ _id: 'al2', title: 'Update', category: 'INFO' });
        User.countDocuments.mockResolvedValue(10);
        SmartAlertService.handleNewAlert.mockResolvedValue(undefined);

        const req = mockReq({
            targetRoles: ['CITIZEN', 'OFFICER'],
            title: 'Update',
            message: 'Park closed tomorrow',
        });
        const res = mockRes();
        await sendCustomAlert(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('400 – empty targetRoles', async () => {
        const req = mockReq({ targetRoles: [], title: 'T', message: 'M' });
        const res = mockRes();
        await sendCustomAlert(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 – invalid role in targetRoles', async () => {
        const req = mockReq({ targetRoles: ['HACKER'], title: 'T', message: 'M' });
        const res = mockRes();
        await sendCustomAlert(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ============================================================================
// sendAnnouncement
// ============================================================================
describe('sendAnnouncement', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – sends announcement to all roles', async () => {
        Alert.create.mockResolvedValue({ _id: 'al3', category: 'ANNOUNCEMENT' });
        User.countDocuments.mockResolvedValue(20);

        const req = mockReq({ title: 'New rules', message: 'Please read' });
        const res = mockRes();
        await sendAnnouncement(req, res);

        expect(Alert.create).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'ANNOUNCEMENT', targetRoles: ['CITIZEN', 'OFFICER', 'ADMIN'] })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('400 – missing title or message', async () => {
        const req = mockReq({ message: 'Only message' });
        const res = mockRes();
        await sendAnnouncement(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ============================================================================
// deleteAlert (soft-delete)
// ============================================================================
describe('deleteAlert', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – deactivates alert', async () => {
        Alert.findByIdAndUpdate.mockResolvedValue({ _id: 'al1', isActive: false });

        const req = mockReq({}, { id: 'al1' });
        const res = mockRes();
        await deleteAlert(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: 'Alert deactivated successfully' });
    });

    test('404 – alert not found', async () => {
        Alert.findByIdAndUpdate.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await deleteAlert(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
