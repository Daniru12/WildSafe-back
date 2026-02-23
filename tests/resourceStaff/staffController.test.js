// tests/resourceStaff/staffController.test.js
// Unit tests for controllers/resourceStaff/staffController.js
// Mongoose models are fully mocked — no real DB connection needed.

jest.mock('../../models/resourceStaff/Staff');
jest.mock('../../models/User');

const Staff = require('../../models/resourceStaff/Staff');
const User = require('../../models/User');

const {
    createStaff,
    listStaff,
    getStaff,
    updateStaff,
    deleteStaff,
} = require('../../controllers/resourceStaff/staffController');

// ─── helpers ────────────────────────────────────────────────────────────────
const mockReq = (body = {}, params = {}) => ({ body, params });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================================
// createStaff
// ============================================================================
describe('createStaff', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – creates staff and promotes user role to OFFICER', async () => {
        const body = { userId: 'u1', department: 'Patrol', permissions: ['read'] };
        const user = { _id: 'u1' };
        const created = { _id: 's1', ...body };

        User.findById.mockResolvedValue(user);
        Staff.findOne.mockResolvedValue(null);          // not already assigned
        Staff.create.mockResolvedValue(created);
        User.findByIdAndUpdate.mockResolvedValue(undefined);

        const req = mockReq(body);
        const res = mockRes();
        await createStaff(req, res);

        expect(User.findById).toHaveBeenCalledWith('u1');
        expect(Staff.findOne).toHaveBeenCalledWith({ userId: 'u1' });
        expect(Staff.create).toHaveBeenCalledWith(body);
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { role: 'OFFICER' });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(created);
    });

    test('404 – user not found', async () => {
        User.findById.mockResolvedValue(null);

        const req = mockReq({ userId: 'u-none' });
        const res = mockRes();
        await createStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
        expect(Staff.create).not.toHaveBeenCalled();
    });

    test('400 – staff already assigned to that user', async () => {
        User.findById.mockResolvedValue({ _id: 'u1' });
        Staff.findOne.mockResolvedValue({ _id: 's-existing' });

        const req = mockReq({ userId: 'u1' });
        const res = mockRes();
        await createStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff already assigned' });
        expect(Staff.create).not.toHaveBeenCalled();
    });

    test('500 – returns server error on DB failure', async () => {
        User.findById.mockRejectedValue(new Error('DB error'));

        const req = mockReq({ userId: 'u1' });
        const res = mockRes();
        await createStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Server error' })
        );
    });
});

// ============================================================================
// listStaff
// ============================================================================
describe('listStaff', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns list of staff (populated)', async () => {
        const staffList = [{ _id: 's1' }, { _id: 's2' }];
        const populateMock = jest.fn().mockResolvedValue(staffList);
        Staff.find.mockReturnValue({ populate: populateMock });

        const req = mockReq();
        const res = mockRes();
        await listStaff(req, res);

        expect(Staff.find).toHaveBeenCalledWith();
        expect(populateMock).toHaveBeenCalledWith('userId', '-password');
        expect(res.json).toHaveBeenCalledWith(staffList);
    });

    test('500 – returns server error on DB failure', async () => {
        Staff.find.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq();
        const res = mockRes();
        await listStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// getStaff
// ============================================================================
describe('getStaff', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns staff for valid id', async () => {
        const staff = { _id: 's1', department: 'Patrol' };
        const populateMock = jest.fn().mockResolvedValue(staff);
        Staff.findById.mockReturnValue({ populate: populateMock });

        const req = mockReq({}, { id: 's1' });
        const res = mockRes();
        await getStaff(req, res);

        expect(Staff.findById).toHaveBeenCalledWith('s1');
        expect(res.json).toHaveBeenCalledWith(staff);
    });

    test('404 – staff not found', async () => {
        Staff.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

        const req = mockReq({}, { id: 'unknown' });
        const res = mockRes();
        await getStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Staff.findById.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq({}, { id: 's1' });
        const res = mockRes();
        await getStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// updateStaff
// ============================================================================
describe('updateStaff', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – updates and returns staff', async () => {
        const updated = { _id: 's1', department: 'K9 Unit' };
        const populateMock = jest.fn().mockResolvedValue(updated);
        Staff.findByIdAndUpdate.mockReturnValue({ populate: populateMock });

        const req = mockReq({ department: 'K9 Unit' }, { id: 's1' });
        const res = mockRes();
        await updateStaff(req, res);

        expect(Staff.findByIdAndUpdate).toHaveBeenCalledWith(
            's1', { department: 'K9 Unit' }, { new: true }
        );
        expect(res.json).toHaveBeenCalledWith(updated);
    });

    test('404 – staff not found', async () => {
        Staff.findByIdAndUpdate.mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
        });

        const req = mockReq({ department: 'K9 Unit' }, { id: 'bad-id' });
        const res = mockRes();
        await updateStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Staff.findByIdAndUpdate.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq({}, { id: 's1' });
        const res = mockRes();
        await updateStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// deleteStaff
// ============================================================================
describe('deleteStaff', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – deletes staff successfully', async () => {
        Staff.findByIdAndDelete.mockResolvedValue({ _id: 's1' });

        const req = mockReq({}, { id: 's1' });
        const res = mockRes();
        await deleteStaff(req, res);

        expect(Staff.findByIdAndDelete).toHaveBeenCalledWith('s1');
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff removed' });
    });

    test('404 – staff not found', async () => {
        Staff.findByIdAndDelete.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await deleteStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Staff.findByIdAndDelete.mockRejectedValue(new Error('DB error'));

        const req = mockReq({}, { id: 's1' });
        const res = mockRes();
        await deleteStaff(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Server error' })
        );
    });
});
