jest.mock('../../services/smartAlertService', () => ({
  handleNewAlert: jest.fn().mockResolvedValue({
    notified: 0,
    awarenessAttached: 0,
    whatsapp: { sent: 0, failed: 0, total: 0, recipients: [] }
  })
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');

const User = require('../../models/User');
const Notification = require('../../models/Notification');
const Alert = require('../../models/Alert');
const AwarenessContent = require('../../models/awareness/AwarenessContent');

const TEST_EMAIL_DOMAIN = '@perf-notif-alert-awareness.test';
const PERF_MAX_AVG_MS = Number(process.env.PERF_MAX_AVG_MS || 2500);
const PERF_MAX_P95_MS = Number(process.env.PERF_MAX_P95_MS || 4500);

const uniqueEmail = (role) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${role.toLowerCase()}_${suffix}${TEST_EMAIL_DOMAIN}`;
};

const createUserWithToken = async (role) => {
  const user = await User.create({
    name: `PERF ${role}`,
    email: uniqueEmail(role),
    password: 'password123',
    role,
    status: 'ACTIVE'
  });

  const token = jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET
  );

  return { user, token };
};

const cleanupScopedData = async () => {
  await Promise.all([
    Notification.deleteMany({ title: /^PERF_/ }),
    Alert.deleteMany({ title: /^PERF_/ }),
    AwarenessContent.deleteMany({ title: /^PERF_/ }),
    User.deleteMany({ email: new RegExp(`${TEST_EMAIL_DOMAIN.replace('.', '\\.')}$`) })
  ]);
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const measureRequests = async ({ iterations, requestFactory }) => {
  const durations = [];
  const statuses = [];

  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    const response = await requestFactory();
    const end = process.hrtime.bigint();

    durations.push(Number(end - start) / 1e6);
    statuses.push(response.status);
  }

  const total = durations.reduce((sum, ms) => sum + ms, 0);
  const avg = total / durations.length;
  const p95 = percentile(durations, 95);

  return {
    avg,
    p95,
    min: Math.min(...durations),
    max: Math.max(...durations),
    statuses
  };
};

describe('Performance - Notification, Alerts, Awareness', () => {
  let citizen;
  let officer;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  });

  beforeEach(async () => {
    await cleanupScopedData();

    citizen = await createUserWithToken('CITIZEN');
    officer = await createUserWithToken('OFFICER');

    const notificationDocs = Array.from({ length: 30 }, (_, idx) => ({
      userId: citizen.user._id,
      title: `PERF_Notification_${idx + 1}`,
      message: `Performance notification ${idx + 1}`,
      type: 'SYSTEM',
      priority: 'MEDIUM'
    }));

    const alertDocs = Array.from({ length: 20 }, (_, idx) => ({
      title: `PERF_Alert_${idx + 1}`,
      message: `Performance alert ${idx + 1}`,
      category: 'INFO',
      alertType: 'general',
      priority: 'LOW',
      createdBy: officer.user._id,
      targetRoles: ['CITIZEN'],
      isActive: true
    }));

    const awarenessDocs = Array.from({ length: 20 }, (_, idx) => ({
      title: `PERF_Awareness_${idx + 1}`,
      content: `Performance awareness content ${idx + 1}`,
      category: idx % 2 === 0 ? 'general' : 'fire-safety',
      triggers: idx % 2 === 0 ? ['general'] : ['fire'],
      isActive: true,
      createdBy: officer.user._id
    }));

    await Promise.all([
      Notification.insertMany(notificationDocs),
      Alert.insertMany(alertDocs),
      AwarenessContent.insertMany(awarenessDocs)
    ]);
  });

  afterAll(async () => {
    await cleanupScopedData();
  });

  test('GET /api/notifications stays within response-time budget', async () => {
    const metrics = await measureRequests({
      iterations: 15,
      requestFactory: () => request(app)
        .get('/api/notifications?limit=50&page=1')
        .set('Authorization', `Bearer ${citizen.token}`)
    });

    expect(metrics.statuses.every((status) => status === 200)).toBe(true);
    expect(metrics.avg).toBeLessThanOrEqual(PERF_MAX_AVG_MS);
    expect(metrics.p95).toBeLessThanOrEqual(PERF_MAX_P95_MS);
  });

  test('GET /api/alerts stays within response-time budget', async () => {
    const metrics = await measureRequests({
      iterations: 15,
      requestFactory: () => request(app)
        .get('/api/alerts?limit=50&page=1')
        .set('Authorization', `Bearer ${citizen.token}`)
    });

    expect(metrics.statuses.every((status) => status === 200)).toBe(true);
    expect(metrics.avg).toBeLessThanOrEqual(PERF_MAX_AVG_MS);
    expect(metrics.p95).toBeLessThanOrEqual(PERF_MAX_P95_MS);
  });

  test('GET /api/awareness/active stays within response-time budget', async () => {
    const metrics = await measureRequests({
      iterations: 15,
      requestFactory: () => request(app)
        .get('/api/awareness/active?limit=50&page=1')
        .set('Authorization', `Bearer ${citizen.token}`)
    });

    expect(metrics.statuses.every((status) => status === 200)).toBe(true);
    expect(metrics.avg).toBeLessThanOrEqual(PERF_MAX_AVG_MS);
    expect(metrics.p95).toBeLessThanOrEqual(PERF_MAX_P95_MS);
  });
});
