// tests/resourceStaff/resourceController.test.js
// Unit tests for controllers/resourceStaff/resourceController.js
// Mongoose models are fully mocked — no real DB connection needed.

jest.mock('../../models/resourceStaff/Resource');
jest.mock('../../models/resourceStaff/Staff');

const Resource = require('../../models/resourceStaff/Resource');
const Staff = require('../../models/resourceStaff/Staff');

const {
    createResource,
    listResources,
    getResource,
    assignResource,
    updateResource,
    archiveResource,
} = require('../../controllers/resourceStaff/resourceController');

// ─── helpers ────────────────────────────────────────────────────────────────
const mockReq = (body = {}, params = {}, query = {}) => ({ body, params, query });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ============================================================================
// createResource
// ============================================================================
describe('createResource', () => {
    afterEach(() => jest.clearAllMocks());

    test('201 – creates and returns new resource', async () => {
        const body = { type: 'VEHICLE', description: 'Jeep', metadata: {} };
        const created = { _id: 'r1', ...body };
        Resource.create.mockResolvedValue(created);

        const req = mockReq(body);
        const res = mockRes();
        await createResource(req, res);

        expect(Resource.create).toHaveBeenCalledWith(body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(created);
    });

    test('500 – returns server error when create throws', async () => {
        Resource.create.mockRejectedValue(new Error('DB error'));

        const req = mockReq({ type: 'VEHICLE' });
        const res = mockRes();
        await createResource(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Server error' })
        );
    });
});

// ============================================================================
// listResources
// ============================================================================
describe('listResources', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns all resources without filter', async () => {
        const resources = [{ _id: 'r1' }, { _id: 'r2' }];
        const populateMock = jest.fn().mockResolvedValue(resources);
        Resource.find.mockReturnValue({ populate: populateMock });

        const req = mockReq({}, {}, {});   // no ?status query
        const res = mockRes();
        await listResources(req, res);

        expect(Resource.find).toHaveBeenCalledWith({});
        expect(res.json).toHaveBeenCalledWith(resources);
    });

    test('200 – filters by status (uppercased)', async () => {
        const resources = [{ _id: 'r1', status: 'AVAILABLE' }];
        const populateMock = jest.fn().mockResolvedValue(resources);
        Resource.find.mockReturnValue({ populate: populateMock });

        const req = mockReq({}, {}, { status: 'available' });
        const res = mockRes();
        await listResources(req, res);

        expect(Resource.find).toHaveBeenCalledWith({ status: 'AVAILABLE' });
        expect(res.json).toHaveBeenCalledWith(resources);
    });

    test('500 – returns server error when find throws', async () => {
        Resource.find.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq({}, {}, {});
        const res = mockRes();
        await listResources(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// getResource
// ============================================================================
describe('getResource', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – returns resource for valid id', async () => {
        const resource = { _id: 'r1', type: 'VEHICLE' };
        const populateMock = jest.fn().mockResolvedValue(resource);
        Resource.findById.mockReturnValue({ populate: populateMock });

        const req = mockReq({}, { id: 'r1' });
        const res = mockRes();
        await getResource(req, res);

        expect(Resource.findById).toHaveBeenCalledWith('r1');
        expect(res.json).toHaveBeenCalledWith(resource);
    });

    test('404 – resource not found', async () => {
        Resource.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });

        const req = mockReq({}, { id: 'unknown' });
        const res = mockRes();
        await getResource(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Resource.findById.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('DB error')),
        });

        const req = mockReq({}, { id: 'r1' });
        const res = mockRes();
        await getResource(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// assignResource
// ============================================================================
describe('assignResource', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – assigns staff to resource', async () => {
        const saveMock = jest.fn().mockResolvedValue(undefined);
        const resource = { _id: 'r1', assignedTo: null, status: 'AVAILABLE', save: saveMock };
        const staff = { _id: 's1' };

        Resource.findById.mockResolvedValue(resource);
        Staff.findById.mockResolvedValue(staff);

        const req = mockReq({ staffId: 's1' }, { id: 'r1' });
        const res = mockRes();
        await assignResource(req, res);

        expect(resource.assignedTo).toBe('s1');
        expect(resource.status).toBe('ASSIGNED');
        expect(saveMock).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(resource);
    });

    test('404 – resource not found', async () => {
        Resource.findById.mockResolvedValue(null);

        const req = mockReq({ staffId: 's1' }, { id: 'bad-id' });
        const res = mockRes();
        await assignResource(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
    });

    test('404 – staff not found', async () => {
        Resource.findById.mockResolvedValue({ _id: 'r1', save: jest.fn() });
        Staff.findById.mockResolvedValue(null);

        const req = mockReq({ staffId: 'bad-staff' }, { id: 'r1' });
        const res = mockRes();
        await assignResource(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Staff not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Resource.findById.mockRejectedValue(new Error('DB error'));

        const req = mockReq({ staffId: 's1' }, { id: 'r1' });
        const res = mockRes();
        await assignResource(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// updateResource
// ============================================================================
describe('updateResource', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – updates and returns resource', async () => {
        const updated = { _id: 'r1', type: 'EQUIPMENT' };
        Resource.findByIdAndUpdate.mockResolvedValue(updated);

        const req = mockReq({ type: 'EQUIPMENT' }, { id: 'r1' });
        const res = mockRes();
        await updateResource(req, res);

        expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
            'r1', { type: 'EQUIPMENT' }, { new: true }
        );
        expect(res.json).toHaveBeenCalledWith(updated);
    });

    test('404 – resource not found', async () => {
        Resource.findByIdAndUpdate.mockResolvedValue(null);

        const req = mockReq({ type: 'EQUIPMENT' }, { id: 'bad-id' });
        const res = mockRes();
        await updateResource(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Resource.findByIdAndUpdate.mockRejectedValue(new Error('DB error'));

        const req = mockReq({}, { id: 'r1' });
        const res = mockRes();
        await updateResource(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================================================
// archiveResource
// ============================================================================
describe('archiveResource', () => {
    afterEach(() => jest.clearAllMocks());

    test('200 – archives resource (status → ARCHIVED)', async () => {
        const archived = { _id: 'r1', status: 'ARCHIVED' };
        Resource.findByIdAndUpdate.mockResolvedValue(archived);

        const req = mockReq({}, { id: 'r1' });
        const res = mockRes();
        await archiveResource(req, res);

        expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
            'r1', { status: 'ARCHIVED' }, { new: true }
        );
        expect(res.json).toHaveBeenCalledWith(archived);
    });

    test('404 – resource not found', async () => {
        Resource.findByIdAndUpdate.mockResolvedValue(null);

        const req = mockReq({}, { id: 'bad-id' });
        const res = mockRes();
        await archiveResource(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
    });

    test('500 – returns server error on DB failure', async () => {
        Resource.findByIdAndUpdate.mockRejectedValue(new Error('DB error'));

        const req = mockReq({}, { id: 'r1' });
        const res = mockRes();
        await archiveResource(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
