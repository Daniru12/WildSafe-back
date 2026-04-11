/**
 * Ranger performance tests — list, suggested-actions, and parallel case detail under load.
 * Uses tests/setupRanger.js (ranger Jest project). Requires MongoDB.
 */

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-dummy';
process.env.COHERE_API_KEY = process.env.COHERE_API_KEY || 'test-cohere-dummy';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const User = require('../../models/User');
const Case = require('../../models/Case');
const ThreatReport = require('../../models/ThreatReport');
const RangerMission = require('../../models/RangerMission');

const generateCaseId = () => {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).substr(2, 5);
  return `CS-PERF-${t}-${r}`.toUpperCase();
};

const generateReportId = () => {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).substr(2, 5);
  return `TR-PERF-${t}-${r}`.toUpperCase();
};

describe('Ranger performance', () => {
  let officerToken;
  let officerUser;
  const PERF_EMAIL = 'ranger-perf@test.com';
  const CASE_COUNT = 35;
  const perfCaseIds = [];

  beforeAll(async () => {
    jest.setTimeout(90000);
    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wildsafe_test';
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    }

    await User.deleteMany({ email: PERF_EMAIL });
    officerUser = await User.create({
      name: 'Ranger Perf',
      email: PERF_EMAIL,
      password: 'password123',
      role: 'OFFICER'
    });
    officerToken = jwt.sign({ id: officerUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');

    const reports = [];
    const cases = [];
    const missions = [];
    for (let i = 0; i < CASE_COUNT; i++) {
      const caseId = generateCaseId();
      perfCaseIds.push(caseId);
      reports.push({
        reportId: generateReportId(),
        threatType: 'POACHING',
        location: { lat: 10 + i * 0.001, lng: 20, address: `Perf ${i}` },
        dateTime: new Date(),
        description: `Perf threat ${i}`,
        reporterInfo: { name: 'Perf', email: 'perf@test.com' }
      });
    }
    const insertedReports = await ThreatReport.insertMany(reports);
    for (let i = 0; i < CASE_COUNT; i++) {
      cases.push({
        caseId: perfCaseIds[i],
        threatReportId: insertedReports[i]._id,
        threatType: 'POACHING',
        location: { lat: 10, lng: 20, address: 'Perf' },
        dateTime: new Date(),
        assignedOfficer: officerUser._id,
        status: 'IN_PROGRESS',
        priority: 'MEDIUM'
      });
      missions.push({
        caseId: perfCaseIds[i],
        assignedTo: officerUser._id,
        rangerStatus: 'ASSIGNED',
        rangerStatusHistory: [{ status: 'ASSIGNED', changedAt: new Date() }]
      });
    }
    await Case.insertMany(cases);
    await RangerMission.insertMany(missions);
  });

  afterAll(async () => {
    await Case.deleteMany({ caseId: { $in: perfCaseIds } });
    await RangerMission.deleteMany({ caseId: { $in: perfCaseIds } });
    await ThreatReport.deleteMany({ reportId: /^TR-PERF-/i });
    await User.deleteMany({ email: PERF_EMAIL });
  });

  it('GET /api/ranger/cases with many missions completes within budget', async () => {
    const t0 = Date.now();
    const res = await request(app)
      .get('/api/ranger/cases')
      .query({ limit: 50, page: 1 })
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);
    const ms = Date.now() - t0;
    expect(res.body.cases.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(CASE_COUNT);
    expect(ms).toBeLessThan(20000);
  });

  it('GET /api/ranger/cases/:caseId/suggested-actions stays within budget (fallback or Groq)', async () => {
    const caseId = perfCaseIds[0];
    const t0 = Date.now();
    const res = await request(app)
      .get(`/api/ranger/cases/${caseId}/suggested-actions`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);
    const ms = Date.now() - t0;
    expect(Array.isArray(res.body.suggestedActions)).toBe(true);
    expect(res.body.suggestedActions.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(25000);
  });

  it('parallel GET case detail for distinct cases completes within budget', async () => {
    const slice = perfCaseIds.slice(0, 12);
    const t0 = Date.now();
    const results = await Promise.all(
      slice.map((caseId) =>
        request(app)
          .get(`/api/ranger/cases/${caseId}`)
          .set('Authorization', `Bearer ${officerToken}`)
          .expect(200)
      )
    );
    const ms = Date.now() - t0;
    expect(results.every((r) => r.body.caseId && r.body.rangerStatus)).toBe(true);
    expect(ms).toBeLessThan(25000);
  });
});
