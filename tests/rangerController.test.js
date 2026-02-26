
// Dummy API keys so app loads without real OpenAI/Cohere (analytics routes load these)
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-dummy';
process.env.COHERE_API_KEY = process.env.COHERE_API_KEY || 'test-cohere-dummy';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Case = require('../models/Case');
const ThreatReport = require('../models/ThreatReport');
const RangerMission = require('../models/RangerMission');

// --- Helpers: generate unique IDs for test data ---
const generateCaseId = () => {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).substr(2, 5);
  return `CS-${t}-${r}`.toUpperCase();
};

const generateReportId = () => {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).substr(2, 5);
  return `TR-${t}-${r}`.toUpperCase();
};

/**
 * Creates a Case + ThreatReport assigned to the given officer.
 * Optionally creates a RangerMission in the given rangerStatus (e.g. 'ASSIGNED', 'ON_SITE').
 * Uses insertMany to avoid Case pre('save') issues in tests. Returns the caseId.
 */
async function createCaseForOfficer(officerId, rangerStatus = null) {
  const [report] = await ThreatReport.insertMany([{
    reportId: generateReportId(),
    threatType: 'POACHING',
    location: { lat: 10, lng: 20, address: 'Test Location' },
    dateTime: new Date(),
    description: 'Test threat',
    reporterInfo: { name: 'Reporter', email: 'r@test.com' }
  }]);
  const caseId = generateCaseId();
  await Case.insertMany([{
    caseId,
    threatReportId: report._id,
    threatType: 'POACHING',
    location: { lat: 10, lng: 20, address: 'Test Location' },
    dateTime: new Date(),
    assignedOfficer: officerId,
    status: 'IN_PROGRESS',
    priority: 'MEDIUM'
  }]);
  if (rangerStatus) {
    await RangerMission.create({
      caseId,
      assignedTo: officerId,
      rangerStatus,
      rangerStatusHistory: [{ status: rangerStatus, changedAt: new Date() }]
    });
  }
  return caseId;
}

// ========== Test suite: Ranger API ==========
describe('Ranger API Tests', () => {
  let officerToken, citizenToken, adminToken;
  let officerUser, citizenUser;

  // Connect to MongoDB and create test users (OFFICER, CITIZEN, ADMIN) with JWT tokens
  beforeAll(async () => {
    jest.setTimeout(20000);
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('connected', resolve);
        setTimeout(resolve, 6000);
      });
    }
    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wildsafe_test';
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      } catch (e) {
        throw new Error('MongoDB not connected. Start MongoDB or set MONGODB_URI / MONGODB_TEST_URI in .env. Ranger API tests need a running DB.');
      }
    }
    await User.deleteMany({ email: { $in: ['ranger-officer@test.com', 'ranger-citizen@test.com', 'admin-ranger@test.com'] } });

    officerUser = await User.create({
      name: 'Ranger Officer',
      email: 'ranger-officer@test.com',
      password: 'password123',
      role: 'OFFICER'
    });
    citizenUser = await User.create({
      name: 'Ranger Citizen',
      email: 'ranger-citizen@test.com',
      password: 'password123',
      role: 'CITIZEN'
    });
    const adminUser = await User.create({
      name: 'Ranger Admin',
      email: 'admin-ranger@test.com',
      password: 'password123',
      role: 'ADMIN'
    });

    officerToken = jwt.sign({ id: officerUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
    citizenToken = jwt.sign({ id: citizenUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
    adminToken = jwt.sign({ id: adminUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
  });

  // ---------- GET /api/ranger (ranger dashboard / health) ----------
  describe('GET /api/ranger', () => {
    it('should return 401 without token', async () => {
      await request(app).get('/api/ranger').expect(401);
    });

    it('should return 403 for citizen role', async () => {
      const res = await request(app)
        .get('/api/ranger')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);
      expect(res.body.message).toMatch(/Access denied|insufficient permissions/i);
    });

    it('should return 200 and message for officer', async () => {
      const res = await request(app)
        .get('/api/ranger')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.message).toBe('Ranger API ok');
      expect(res.body.user).toBeDefined();
    });
  });

  // ---------- GET /api/ranger/cases (list assigned cases with pagination) ----------
  describe('GET /api/ranger/cases', () => {
    it('should return 401 without token', async () => {
      await request(app).get('/api/ranger/cases').expect(401);
    });

    it('should return 200 with cases and pagination for officer', async () => {
      await createCaseForOfficer(officerUser._id);
      const res = await request(app)
        .get('/api/ranger/cases')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(Array.isArray(res.body.cases)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination).toHaveProperty('current');
      expect(res.body.pagination).toHaveProperty('total');
    });
  });

  // ---------- GET /api/ranger/cases/:caseId (single case detail for ranger) ----------
  describe('GET /api/ranger/cases/:caseId', () => {
    it('should return 401 without token', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ASSIGNED');
      await request(app).get(`/api/ranger/cases/${caseId}`).expect(401);
    });

    it('should return 403 when case not assigned to officer', async () => {
      const [report] = await ThreatReport.insertMany([{
        reportId: generateReportId(),
        threatType: 'OTHER',
        location: { lat: 1, lng: 2, address: 'Other' },
        dateTime: new Date(),
        description: 'Other',
        reporterInfo: { name: 'R' }
      }]);
      const otherCaseId = generateCaseId();
      await Case.insertMany([{
        caseId: otherCaseId,
        threatReportId: report._id,
        threatType: 'OTHER',
        location: { lat: 1, lng: 2, address: 'Other' },
        dateTime: new Date(),
        assignedOfficer: citizenUser._id
      }]);
      const res = await request(app)
        .get(`/api/ranger/cases/${otherCaseId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(403);
      expect(res.body.message).toMatch(/not assigned/i);
    });

    it('should return 200 with case detail when assigned', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ASSIGNED');
      const res = await request(app)
        .get(`/api/ranger/cases/${caseId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.caseId).toBe(caseId);
      expect(res.body.rangerStatus).toBeDefined();
      expect(res.body.evidence).toBeDefined();
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/accept (officer accepts mission) ----------
  describe('POST /api/ranger/cases/:caseId/accept', () => {
    it('should return 401 without token', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ASSIGNED');
      await request(app).post(`/api/ranger/cases/${caseId}/accept`).expect(401);
    });

    it('should return 404 for non-existent case', async () => {
      const res = await request(app)
        .post('/api/ranger/cases/CS-NONE-XXXXX/accept')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should accept mission and return 200', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ASSIGNED');
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/accept`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.message).toMatch(/accepted/i);
      expect(res.body.rangerStatus).toBe('ACCEPTED');
    });

    it('should return 400 when already accepted', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ACCEPTED');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/accept`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(400);
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/start-mission (set status EN_ROUTE) ----------
  describe('POST /api/ranger/cases/:caseId/start-mission', () => {
    it('should return 200 and set EN_ROUTE', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ACCEPTED');
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/start-mission`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.rangerStatus).toBe('EN_ROUTE');
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/arrive-on-site (set status ON_SITE) ----------
  describe('POST /api/ranger/cases/:caseId/arrive-on-site', () => {
    it('should return 200 and set ON_SITE', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ACCEPTED');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/start-mission`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/arrive-on-site`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ notes: 'Arrived' })
        .expect(200);
      expect(res.body.rangerStatus).toBe('ON_SITE');
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/action-taken (set status ACTION_TAKEN) ----------
  describe('POST /api/ranger/cases/:caseId/action-taken', () => {
    it('should return 200 and set ACTION_TAKEN', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ACCEPTED');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/start-mission`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      await request(app)
        .post(`/api/ranger/cases/${caseId}/arrive-on-site`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/action-taken`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.rangerStatus).toBe('ACTION_TAKEN');
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/evidence (add evidence to mission) ----------
  describe('POST /api/ranger/cases/:caseId/evidence', () => {
    it('should return 401 without token', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/evidence`)
        .send({ description: 'test' })
        .expect(401);
    });

    it('should add text evidence and return 200', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/evidence`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ description: 'Test evidence', notes: 'Notes here' })
        .expect(200);
      expect(res.body.evidence).toBeDefined();
      expect(Array.isArray(res.body.evidence)).toBe(true);
      expect(res.body.evidence.length).toBeGreaterThan(0);
    });
  });

  // ---------- DELETE /api/ranger/cases/:caseId/evidence/:evidenceId (remove one evidence) ----------
  describe('DELETE /api/ranger/cases/:caseId/evidence/:evidenceId', () => {
    it('should return 400 for invalid evidence id', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .delete(`/api/ranger/cases/${caseId}/evidence/invalid-id`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent evidence id', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .delete(`/api/ranger/cases/${caseId}/evidence/${fakeId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(404);
    });

    it('should delete evidence and return 200 when id valid', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/evidence`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ description: 'To delete', notes: 'x' })
        .expect(200);
      const mission = await RangerMission.findOne({ caseId, assignedTo: officerUser._id });
      expect(mission.evidence.length).toBeGreaterThan(0);
      const id = mission.evidence[mission.evidence.length - 1]._id.toString();
      const res = await request(app)
        .delete(`/api/ranger/cases/${caseId}/evidence/${id}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(res.body.evidence).toBeDefined();
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/close (close case, set RESOLVED, write resolution) ----------
  describe('POST /api/ranger/cases/:caseId/close', () => {
    it('should return 401 without token', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/close`)
        .send({ actionTaken: 'Done', solutionProvided: 'Fixed' })
        .expect(401);
    });

    it('should return 400 when missing actionTaken or solutionProvided', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/close`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ actionTaken: 'Done' })
        .expect(400);
    });

    it('should close case and return 200', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      const res = await request(app)
        .post(`/api/ranger/cases/${caseId}/close`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          actionTaken: 'Action taken summary',
          solutionProvided: 'Solution provided',
          proofUrls: []
        })
        .expect(200);
      expect(res.body.rangerStatus).toBe('CLOSED');
      expect(res.body.caseStatus).toBe('RESOLVED');
    });

    it('should return 400 when case already closed', async () => {
      const caseId = await createCaseForOfficer(officerUser._id, 'ON_SITE');
      await request(app)
        .post(`/api/ranger/cases/${caseId}/close`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          actionTaken: 'First close',
          solutionProvided: 'Done'
        })
        .expect(200);
      await request(app)
        .post(`/api/ranger/cases/${caseId}/close`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          actionTaken: 'Again',
          solutionProvided: 'Again'
        })
        .expect(400);
    });
  });

  // ---------- POST /api/ranger/cases/:caseId/decline (decline mission, unassign case) ----------
  describe('POST /api/ranger/cases/:caseId/decline', () => {
    it('should decline and unassign case', async () => {
      const declineCaseId = await createCaseForOfficer(officerUser._id, 'ASSIGNED');
      const res = await request(app)
        .post(`/api/ranger/cases/${declineCaseId}/decline`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ declineReason: 'Cannot handle' })
        .expect(200);
      expect(res.body.message).toMatch(/declined|unassigned/i);
      const caseDoc = await Case.findOne({ caseId: declineCaseId });
      expect(caseDoc.assignedOfficer).toBeUndefined();
    });
  });
});
