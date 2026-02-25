// tests/notification/notificationController.test.js
// Simple unit tests for the most important notification APIs

jest.mock('../../models/Notification');
jest.mock('../../models/User');

const Notification = require('../../models/Notification');
const User = require('../../models/User');

const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    notifyByRole,
} = require('../../controllers/notificationController');

// ─── helpers ────────────────────────────────────────────────────────────────
const mockReq = (body = {}, params = {}, query = {}, user = { id: 'u1', role: 'CITIZEN' }) => ({
    body, params, query, user,
});
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================================
// getNotifications
// ============================================================================
describe('getNotifications', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns paginated notifications for user', async () => {
        const notifications = [{ _id: 'n1' }, { _id: 'n2' }];
        Notification.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            skip: jest.fn().mockResolvedValue(notifications),
        });
        Notification.countDocuments.mockResolvedValue(2);

        const req = mockReq({}, {}, { limit: '50', page: '1' });
        const res = mockRes();
        await getNotifications(req, res);

        expect(Notification.find).toHaveBeenCalledWith({ userId: 'u1' });
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ notifications, pagination: expect.objectContaining({ total: 2 }) })
        );
    });

    test('500 – returns error when DB fails', async () => {
        Notification.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            skip: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq();
        const res = mockRes();
        await getNotifications(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// markAsRead
// ============================================================================
describe('markAsRead', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – marks notification as read', async () => {
        const notification = { _id: 'n1', isRead: false, save: jest.fn().mockResolvedValue(undefined) };
        Notification.findOne.mockResolvedValue(notification);

        const req = mockReq({}, { id: 'n1' });
        const res = mockRes();
        await markAsRead(req, res);

        expect(notification.isRead).toBe(true);
        expect(notification.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Notification marked as read' }));
    });

    test('404 – notification not found', async () => {
        Notification.findOne.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await markAsRead(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ============================================================================
// markAllAsRead
// ============================================================================
describe('markAllAsRead', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – marks all unread as read', async () => {
        Notification.updateMany.mockResolvedValue({ modifiedCount: 4 });

        const req = mockReq();
        const res = mockRes();
        await markAllAsRead(req, res);

        expect(Notification.updateMany).toHaveBeenCalledWith({ userId: 'u1', isRead: false }, { isRead: true });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ modifiedCount: 4 }));
    });
});

// ============================================================================
// deleteNotification
// ============================================================================
describe('deleteNotification', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – deletes notification', async () => {
        Notification.findOneAndDelete.mockResolvedValue({ _id: 'n1' });

        const req = mockReq({}, { id: 'n1' });
        const res = mockRes();
        await deleteNotification(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: 'Notification deleted successfully' });
    });

    test('404 – notification not found', async () => {
        Notification.findOneAndDelete.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await deleteNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ============================================================================
// createNotification (helper)
// ============================================================================
describe('createNotification (helper)', () => {
    afterEach(() => jest.clearAllMocks());

    test('creates and returns a notification', async () => {
        const created = { _id: 'n1', userId: 'u1', title: 'Test' };
        Notification.create.mockResolvedValue(created);

        const result = await createNotification('u1', { title: 'Test', message: 'Hello' });

        expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Test' }));
        expect(result).toEqual(created);
    });
});

// ============================================================================
// notifyByRole (helper)
// ============================================================================
describe('notifyByRole (helper)', () => {
    afterEach(() => jest.clearAllMocks());

    test('sends notifications to users with matching roles', async () => {
        User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]) });
        Notification.insertMany.mockResolvedValue([]);

        const count = await notifyByRole(['OFFICER'], { title: 'Alert', message: 'Heads up' });

        expect(Notification.insertMany).toHaveBeenCalled();
        expect(count).toBe(2);
    });

    test('returns 0 when no matching users', async () => {
        User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });

        const count = await notifyByRole('ADMIN', { title: 'X', message: 'Y' });
        expect(count).toBe(0);
    });
});
