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

const TEST_EMAIL_DOMAIN = '@it-notif-alert-awareness.test';

const uniqueEmail = (role) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${role.toLowerCase()}_${suffix}${TEST_EMAIL_DOMAIN}`;
};

const createUserWithToken = async (role) => {
  const user = await User.create({
    name: `IT ${role}`,
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
    Notification.deleteMany({ title: /^IT_/ }),
    Alert.deleteMany({ title: /^IT_/ }),
    AwarenessContent.deleteMany({ title: /^IT_/ }),
    User.deleteMany({ email: new RegExp(`${TEST_EMAIL_DOMAIN.replace('.', '\\.')}$`) })
  ]);
};

describe('Integration - Notification, Alerts, Awareness', () => {
  let citizen;
  let officer;
  let admin;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  });

  beforeEach(async () => {
    await cleanupScopedData();

    citizen = await createUserWithToken('CITIZEN');
    officer = await createUserWithToken('OFFICER');
    admin = await createUserWithToken('ADMIN');
  });

  afterAll(async () => {
    await cleanupScopedData();
  });

  describe('Notifications API', () => {
    test('GET /api/notifications returns only logged-in user notifications', async () => {
      await Notification.create([
        {
          userId: citizen.user._id,
          title: 'IT_Notification 1',
          message: 'Citizen message 1',
          type: 'SYSTEM'
        },
        {
          userId: citizen.user._id,
          title: 'IT_Notification 2',
          message: 'Citizen message 2',
          type: 'SYSTEM'
        },
        {
          userId: officer.user._id,
          title: 'IT_Notification 3',
          message: 'Officer message',
          type: 'SYSTEM'
        }
      ]);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.notifications.every((n) => n.userId === citizen.user._id.toString())).toBe(true);
    });

    test('PUT /api/notifications/:id/read marks one notification as read', async () => {
      const notification = await Notification.create({
        userId: citizen.user._id,
        title: 'IT_Read test',
        message: 'Mark me read',
        type: 'SYSTEM',
        isRead: false
      });

      await request(app)
        .put(`/api/notifications/${notification._id}/read`)
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      const updated = await Notification.findById(notification._id);
      expect(updated.isRead).toBe(true);
    });

    test('PUT /api/notifications/read-all marks all unread notifications as read', async () => {
      await Notification.create([
        {
          userId: citizen.user._id,
          title: 'IT_Bulk read 1',
          message: 'Unread 1',
          type: 'SYSTEM',
          isRead: false
        },
        {
          userId: citizen.user._id,
          title: 'IT_Bulk read 2',
          message: 'Unread 2',
          type: 'SYSTEM',
          isRead: false
        }
      ]);

      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      expect(response.body.modifiedCount).toBe(2);
      const unreadCount = await Notification.countDocuments({
        userId: citizen.user._id,
        isRead: false,
        title: /^IT_Bulk/
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe('Alerts API', () => {
    test('OFFICER creates custom alert and CITIZEN can retrieve it', async () => {
      const createResponse = await request(app)
        .post('/api/alerts/custom')
        .set('Authorization', `Bearer ${officer.token}`)
        .send({
          title: 'IT_Custom Alert',
          message: 'Integration alert message',
          targetRoles: ['CITIZEN'],
          category: 'INFO',
          priority: 'MEDIUM',
          alertType: 'fire'
        })
        .expect(201);

      expect(createResponse.body.alert).toBeDefined();
      expect(createResponse.body.alert.title).toBe('IT_Custom Alert');

      const getResponse = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      const hasCreatedAlert = getResponse.body.alerts.some((a) => a.title === 'IT_Custom Alert');
      expect(hasCreatedAlert).toBe(true);
    });

    test('Only ADMIN can deactivate alert', async () => {
      const alert = await Alert.create({
        title: 'IT_Admin Delete Alert',
        message: 'Delete me',
        category: 'WARNING',
        alertType: 'poaching',
        priority: 'HIGH',
        createdBy: officer.user._id,
        targetRoles: ['CITIZEN', 'OFFICER'],
        isActive: true
      });

      await request(app)
        .delete(`/api/alerts/${alert._id}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .expect(403);

      await request(app)
        .delete(`/api/alerts/${alert._id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      const updated = await Alert.findById(alert._id);
      expect(updated.isActive).toBe(false);
    });
  });

  describe('Awareness API', () => {
    test('OFFICER can create and update awareness content', async () => {
      const createResponse = await request(app)
        .post('/api/awareness')
        .set('Authorization', `Bearer ${officer.token}`)
        .send({
          title: 'IT_Awareness Fire Basics',
          content: 'Keep emergency paths clear and follow ranger instructions.',
          category: 'fire-safety',
          triggers: ['fire'],
          schedule: 'weekly'
        })
        .expect(201);

      const awarenessId = createResponse.body.awareness._id;

      const patchResponse = await request(app)
        .patch(`/api/awareness/${awarenessId}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .send({ title: 'IT_Awareness Fire Basics Updated' })
        .expect(200);

      expect(patchResponse.body.awareness.title).toBe('IT_Awareness Fire Basics Updated');
    });

    test('Active and relevant awareness endpoints return scoped content', async () => {
      await AwarenessContent.create({
        title: 'IT_Relevant Fire Awareness',
        content: 'Fire relevant awareness text.',
        category: 'fire-safety',
        triggers: ['fire'],
        isActive: true,
        createdBy: officer.user._id
      });

      const activeResponse = await request(app)
        .get('/api/awareness/active')
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      const hasActive = activeResponse.body.awareness.some((item) => item.title === 'IT_Relevant Fire Awareness');
      expect(hasActive).toBe(true);

      const relevantResponse = await request(app)
        .get('/api/awareness/relevant/fire')
        .set('Authorization', `Bearer ${citizen.token}`)
        .expect(200);

      expect(relevantResponse.body.alertType).toBe('fire');
      expect(relevantResponse.body.count).toBeGreaterThan(0);
    });

    test('Only ADMIN can deactivate awareness content', async () => {
      const awareness = await AwarenessContent.create({
        title: 'IT_Delete Awareness',
        content: 'Delete test awareness',
        category: 'general',
        triggers: ['general'],
        isActive: true,
        createdBy: officer.user._id
      });

      await request(app)
        .delete(`/api/awareness/${awareness._id}`)
        .set('Authorization', `Bearer ${officer.token}`)
        .expect(403);

      await request(app)
        .delete(`/api/awareness/${awareness._id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      const updated = await AwarenessContent.findById(awareness._id);
      expect(updated.isActive).toBe(false);
    });
  });
});
