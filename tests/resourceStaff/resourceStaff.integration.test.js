const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../../app');
const User = require('../../models/User');
const Staff = require('../../models/resourceStaff/Staff');
const Resource = require('../../models/resourceStaff/Resource');

const signToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test_secret');

const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@test.com`;

describe('Resource & Staff Integration', () => {
  let admin;
  let officerOne;
  let officerTwo;
  let adminToken;
  let officerOneToken;
  let officerTwoToken;

  beforeEach(async () => {
    admin = await User.create({
      name: 'RS Admin',
      email: uniqueEmail('rs.admin'),
      password: 'Pass12345!',
      role: 'ADMIN'
    });

    officerOne = await User.create({
      name: 'RS Officer One',
      email: uniqueEmail('rs.officer.one'),
      password: 'Pass12345!',
      role: 'OFFICER'
    });

    officerTwo = await User.create({
      name: 'RS Officer Two',
      email: uniqueEmail('rs.officer.two'),
      password: 'Pass12345!',
      role: 'OFFICER'
    });

    adminToken = signToken(admin._id.toString());
    officerOneToken = signToken(officerOne._id.toString());
    officerTwoToken = signToken(officerTwo._id.toString());
  });

  afterEach(async () => {
    await Promise.all([
      Resource.deleteMany({ description: /RS Integration/ }),
      Staff.deleteMany({}),
      User.deleteMany({ email: /@test\.com$/ })
    ]);
  });

  test('admin can create staff and user role is promoted to OFFICER', async () => {
    const citizen = await User.create({
      name: 'RS Citizen',
      email: uniqueEmail('rs.citizen'),
      password: 'Pass12345!',
      role: 'CITIZEN'
    });

    const response = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: citizen._id.toString(),
        department: 'PATROL',
        permissions: ['VIEW_RESOURCES']
      });

    expect(response.status).toBe(201);
    expect(response.body.userId.toString()).toBe(citizen._id.toString());

    const updatedCitizen = await User.findById(citizen._id);
    expect(updatedCitizen.role).toBe('OFFICER');
  });

  test('officer can take available resource without providing staffId', async () => {
    const resourceCreate = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'DRONE',
        description: 'RS Integration Drone',
        metadata: { serialNumber: 'RS-DR-001', location: 'North Zone' }
      });

    expect(resourceCreate.status).toBe(201);

    const takeResponse = await request(app)
      .put(`/api/resources/${resourceCreate.body._id}/assign`)
      .set('Authorization', `Bearer ${officerOneToken}`)
      .send({});

    expect(takeResponse.status).toBe(200);
    expect(takeResponse.body.status).toBe('ASSIGNED');
    expect(takeResponse.body.assignedTo).toBeTruthy();
    expect(takeResponse.body.assignedTo.userId).toBeTruthy();
    expect(takeResponse.body.assignedTo.userId._id.toString()).toBe(officerOne._id.toString());
  });

  test('resource lock prevents another officer from taking an already assigned resource', async () => {
    const createResponse = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'EQUIPMENT',
        description: 'RS Integration Thermal Camera',
        metadata: { serialNumber: 'RS-EQ-001', location: 'East Zone' }
      });

    expect(createResponse.status).toBe(201);

    const firstTake = await request(app)
      .put(`/api/resources/${createResponse.body._id}/assign`)
      .set('Authorization', `Bearer ${officerOneToken}`)
      .send({});

    expect(firstTake.status).toBe(200);

    const secondTake = await request(app)
      .put(`/api/resources/${createResponse.body._id}/assign`)
      .set('Authorization', `Bearer ${officerTwoToken}`)
      .send({});

    expect(secondTake.status).toBe(409);
    expect(secondTake.body.message).toMatch(/already in use|Release it first/i);
  });

  test('officer can set assigned resource back to available', async () => {
    const createResponse = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'VEHICLE',
        description: 'RS Integration Patrol Vehicle',
        metadata: { serialNumber: 'RS-VE-001', location: 'Base Camp' }
      });

    expect(createResponse.status).toBe(201);

    const assignResponse = await request(app)
      .put(`/api/resources/${createResponse.body._id}/assign`)
      .set('Authorization', `Bearer ${officerOneToken}`)
      .send({});

    expect(assignResponse.status).toBe(200);

    const releaseResponse = await request(app)
      .put(`/api/resources/${createResponse.body._id}`)
      .set('Authorization', `Bearer ${officerOneToken}`)
      .send({
        status: 'AVAILABLE',
        assignedTo: null
      });

    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.body.status).toBe('AVAILABLE');
    expect(releaseResponse.body.assignedTo).toBeNull();
  });
});
