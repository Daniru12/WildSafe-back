// tests/notification/awarenessController.test.js
// Simple unit tests for the most important awareness APIs

jest.mock('../../models/awareness/AwarenessContent');
jest.mock('../../models/Notification');
jest.mock('../../models/User');

const AwarenessContent = require('../../models/awareness/AwarenessContent');

const {
    createAwareness,
    getActiveContent,
    getRelevantAwareness,
    getAwarenessById,
    updateAwareness,
    deleteAwareness,
} = require('../../controllers/awarenessController');

// ─── helpers ────────────────────────────────────────────────────────────────
const mockReq = (body = {}, params = {}, query = {}, user = { id: 'u1', role: 'ADMIN' }) => ({
    body, params, query, user,
});
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================================
// createAwareness
// ============================================================================
describe('createAwareness', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – creates awareness content', async () => {
        const body = { title: 'Fire safety', content: 'Stay low...', category: 'fire-safety' };
        AwarenessContent.create.mockResolvedValue({ _id: 'a1', ...body, createdBy: 'u1' });

        const req = mockReq(body);
        const res = mockRes();
        await createAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Awareness content created' }));
    });

    test('400 – missing required fields', async () => {
        const req = mockReq({ title: 'Only title' });
        const res = mockRes();
        await createAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('500 – returns error when DB fails', async () => {
        AwarenessContent.create.mockRejectedValue(new Error('DB error'));

        const req = mockReq({ title: 'T', content: 'C', category: 'general' });
        const res = mockRes();
        await createAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// getActiveContent
// ============================================================================
describe('getActiveContent', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns paginated active awareness content', async () => {
        const items = [{ _id: 'a1' }, { _id: 'a2' }];
        AwarenessContent.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            skip: jest.fn().mockResolvedValue(items),
        });
        AwarenessContent.countDocuments.mockResolvedValue(2);

        const req = mockReq({}, {}, { limit: '50', page: '1' });
        const res = mockRes();
        await getActiveContent(req, res);

        expect(AwarenessContent.find).toHaveBeenCalledWith({ isActive: true });
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ awareness: items, pagination: expect.objectContaining({ total: 2 }) })
        );
    });
});

// ============================================================================
// getRelevantAwareness
// ============================================================================
describe('getRelevantAwareness', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns awareness for valid alertType', async () => {
        const items = [{ _id: 'a1', triggers: ['fire'] }];
        AwarenessContent.find.mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockResolvedValue(items),
        });

        const req = mockReq({}, { alertType: 'fire' });
        const res = mockRes();
        await getRelevantAwareness(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alertType: 'fire', count: 1 }));
    });

    test('400 – invalid alertType', async () => {
        const req = mockReq({}, { alertType: 'earthquake' });
        const res = mockRes();
        await getRelevantAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ============================================================================
// getAwarenessById
// ============================================================================
describe('getAwarenessById', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns awareness item by id', async () => {
        const item = { _id: 'a1', title: 'Fire safety' };
        AwarenessContent.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(item) });

        const req = mockReq({}, { id: 'a1' });
        const res = mockRes();
        await getAwarenessById(req, res);

        expect(res.json).toHaveBeenCalledWith({ awareness: item });
    });

    test('404 – awareness not found', async () => {
        AwarenessContent.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await getAwarenessById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ============================================================================
// updateAwareness
// ============================================================================
describe('updateAwareness', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – updates awareness content', async () => {
        AwarenessContent.findByIdAndUpdate.mockResolvedValue({ _id: 'a1', title: 'Updated' });

        const req = mockReq({ title: 'Updated' }, { id: 'a1' });
        const res = mockRes();
        await updateAwareness(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Awareness content updated' }));
    });

    test('404 – awareness not found', async () => {
        AwarenessContent.findByIdAndUpdate.mockResolvedValue(null);

        const req = mockReq({ title: 'T' }, { id: 'bad-id' });
        const res = mockRes();
        await updateAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ============================================================================
// deleteAwareness (soft-delete)
// ============================================================================
describe('deleteAwareness', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – deactivates awareness content', async () => {
        AwarenessContent.findByIdAndUpdate.mockResolvedValue({ _id: 'a1', isActive: false });

        const req = mockReq({}, { id: 'a1' });
        const res = mockRes();
        await deleteAwareness(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: 'Awareness content deactivated successfully' });
    });

    test('404 – awareness not found', async () => {
        AwarenessContent.findByIdAndUpdate.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await deleteAwareness(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
