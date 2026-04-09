const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Incident = require('../models/Incident');

describe('Incident Controller Tests', () => {
  let citizenToken, officerToken, adminToken;
  let citizenUser, officerUser, adminUser;
  let testIncident;

  beforeAll(async () => {
    // Clean up users first to avoid duplicate key errors
    await User.deleteMany({});
    
    // Create test users
    const citizenData = {
      name: 'Test Citizen',
      email: 'citizen@test.com',
      password: 'password123',
      role: 'CITIZEN'
    };

    const officerData = {
      name: 'Test Officer',
      email: 'officer@test.com',
      password: 'password123',
      role: 'OFFICER'
    };

    const adminData = {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'ADMIN'
    };

    citizenUser = await User.create(citizenData);
    officerUser = await User.create(officerData);
    adminUser = await User.create(adminData);

    // Generate tokens - ensure we use the _id as string
    citizenToken = jwt.sign({ id: citizenUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
    officerToken = jwt.sign({ id: officerUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
    adminToken = jwt.sign({ id: adminUser._id.toString() }, process.env.JWT_SECRET || 'test_secret');
    
    console.log('Test users created and tokens generated');
  });

  beforeEach(async () => {
    // Clean up incidents before each test, but keep users
    await Incident.deleteMany({});
  });

  describe('POST /api/incidents - createIncident', () => {
    const incidentData = {
      title: 'Test Incident',
      description: 'This is a test incident description',
      category: 'POACHING',
      location: {
        lat: 12.3456,
        lng: 78.9012,
        address: 'Test Address'
      }
    };

    it('should create a new incident with valid data', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(incidentData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe(incidentData.title);
      expect(response.body.description).toBe(incidentData.description);
      expect(response.body.category).toBe(incidentData.category);
      expect(response.body.reporterId).toBe(citizenUser._id.toString());
      expect(response.body.status).toBe('SUBMITTED');
      expect(response.body.priority).toBe('MEDIUM');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .send(incidentData)
        .expect(401);

      expect(response.body.message).toBe('No token, authorization denied');
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteData = {
        title: 'Test Incident'
        // Missing description, category, location
      };

      const response = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(incompleteData)
        .expect(400); // Returns 400 due to improved validation
    });

    it('should return 400 with invalid category', async () => {
      const invalidData = {
        ...incidentData,
        category: 'INVALID_CATEGORY'
      };

      const response = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(invalidData)
        .expect(400); // Now returns 400 due to improved validation
    });

    it('should return 400 with invalid location coordinates', async () => {
      const invalidLocationData = {
        ...incidentData,
        location: {
          lat: 91, // Invalid latitude
          lng: 78.9012
        }
      };

      const response = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(invalidLocationData)
        .expect(400); // Now returns 400 due to improved validation
    });
  });

  describe('GET /api/incidents/mine - getMyIncidents', () => {
    beforeEach(async () => {
      await Incident.create({
        title: 'Citizen Incident 1',
        description: 'Description 1',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012 },
        reporterId: citizenUser._id
      });

      await Incident.create({
        title: 'Citizen Incident 2',
        description: 'Description 2',
        category: 'FOREST_FIRE',
        location: { lat: 12.3457, lng: 78.9013 },
        reporterId: citizenUser._id
      });

      await Incident.create({
        title: 'Officer Incident',
        description: 'Description 3',
        category: 'ILLEGAL_LOGGING',
        location: { lat: 12.3458, lng: 78.9014 },
        reporterId: officerUser._id
      });
    });

    it('should get all incidents for the logged-in citizen', async () => {
      const response = await request(app)
        .get('/api/incidents/mine')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].reporterId).toBe(citizenUser._id.toString());
      expect(response.body[1].reporterId).toBe(citizenUser._id.toString());
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/incidents/mine')
        .expect(401);

      expect(response.body.message).toBe('No token, authorization denied');
    });

    it('should return empty array for user with no incidents', async () => {
      const response = await request(app)
        .get('/api/incidents/mine')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/incidents/:id - getIncidentById', () => {
    beforeEach(async () => {
      testIncident = await Incident.create({
        title: 'Test Incident',
        description: 'Test description',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012 },
        reporterId: citizenUser._id
      });
    });

    it('should allow citizen to view their own incident', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncident._id}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body._id).toBe(testIncident._id.toString());
      expect(response.body.title).toBe(testIncident.title);
    });

    it('should allow officer to view any incident', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncident._id}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body._id).toBe(testIncident._id.toString());
    });

    it('should allow admin to view any incident', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncident._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body._id).toBe(testIncident._id.toString());
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/incidents/${fakeId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(404);

      expect(response.body.message).toBe('Incident not found');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncident._id}`)
        .expect(401);

      expect(response.body.message).toBe('No token, authorization denied');
    });
  });

  describe('GET /api/incidents/all - getAllIncidents', () => {
    beforeEach(async () => {
      await Incident.create({
        title: 'Incident 1',
        description: 'Description 1',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012 },
        reporterId: citizenUser._id,
        status: 'SUBMITTED'
      });

      await Incident.create({
        title: 'Incident 2',
        description: 'Description 2',
        category: 'FOREST_FIRE',
        location: { lat: 12.3457, lng: 78.9013 },
        reporterId: citizenUser._id,
        status: 'IN_PROGRESS'
      });
    });

    it('should allow officer to get all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('reporterId');
      expect(response.body[0].reporterId).toHaveProperty('name');
    });

    it('should allow admin to get all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return 403 for citizen trying to access all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should filter incidents by status', async () => {
      const response = await request(app)
        .get('/api/incidents/all?status=SUBMITTED')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('SUBMITTED');
    });

    it('should filter incidents by category', async () => {
      const response = await request(app)
        .get('/api/incidents/all?category=POACHING')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('POACHING');
    });
  });

  describe('PATCH /api/incidents/:id/status - updateStatus', () => {
    beforeEach(async () => {
      testIncident = await Incident.create({
        title: 'Test Incident',
        description: 'Test description',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012 },
        reporterId: citizenUser._id,
        status: 'SUBMITTED'
      });
    });

    it('should allow officer to update incident status', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('should allow admin to update incident status', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(response.body.status).toBe('RESOLVED');
    });

    it('should return 403 for citizen trying to update status', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/incidents/${fakeId}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(404);

      expect(response.body.message).toBe('Incident not found');
    });
  });

  describe('PATCH /api/incidents/:id/assign - assignIncident', () => {
    beforeEach(async () => {
      testIncident = await Incident.create({
        title: 'Test Incident',
        description: 'Test description',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012 },
        reporterId: citizenUser._id
      });
    });

    it('should allow admin to assign incident to officer', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          assignedTo: officerUser._id,
          priority: 'HIGH'
        })
        .expect(200);

      expect(response.body.assignedTo).toBe(officerUser._id.toString());
      expect(response.body.priority).toBe('HIGH');
    });

    it('should return 403 for officer trying to assign incident', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/assign`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ assignedTo: officerUser._id })
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 403 for citizen trying to assign incident', async () => {
      const response = await request(app)
        .patch(`/api/incidents/${testIncident._id}/assign`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ assignedTo: officerUser._id })
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 404 for non-existent incident', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/incidents/${fakeId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedTo: officerUser._id })
        .expect(404);

      expect(response.body.message).toBe('Incident not found');
    });
  });

  describe('Integration Tests - Full Workflow', () => {
    it('should complete full incident lifecycle: create, view, update status, assign', async () => {
      const incidentData = {
        title: 'Integration Test Incident',
        description: 'Testing full workflow',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' }
      };

      const createResponse = await request(app)
        .post('/api/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(incidentData)
        .expect(201);

      const incidentId = createResponse.body._id;

      const viewResponse = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(viewResponse.body._id).toBe(incidentId);

      const updateResponse = await request(app)
        .patch(`/api/incidents/${incidentId}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(updateResponse.body.status).toBe('IN_PROGRESS');

      const assignResponse = await request(app)
        .patch(`/api/incidents/${incidentId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedTo: officerUser._id, priority: 'HIGH' })
        .expect(200);

      expect(assignResponse.body.assignedTo).toBe(officerUser._id.toString());
      expect(assignResponse.body.priority).toBe('HIGH');
    });

    it('should handle multiple incidents with different categories', async () => {
      const categories = ['POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING', 'ANIMAL_CONFLICT'];

      for (const category of categories) {
        await request(app)
          .post('/api/incidents')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send({
            title: `${category} Incident`,
            description: `Testing ${category}`,
            category: category,
            location: { lat: 12.3456, lng: 78.9012 }
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(4);

      const poachingIncidents = await request(app)
        .get('/api/incidents/all?category=POACHING')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(poachingIncidents.body).toHaveLength(1);
      expect(poachingIncidents.body[0].category).toBe('POACHING');
    });

    it('should filter incidents by status across full dataset', async () => {
      const statuses = ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'];

      for (const status of statuses) {
        const incident = await Incident.create({
          title: `${status} Incident`,
          description: `Testing ${status}`,
          category: 'POACHING',
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id,
          status: status
        });
      }

      const inProgressResponse = await request(app)
        .get('/api/incidents/all?status=IN_PROGRESS')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(inProgressResponse.body).toHaveLength(1);
      expect(inProgressResponse.body[0].status).toBe('IN_PROGRESS');
    });

    it('should handle incident with assigned officer workflow', async () => {
      const incident = await Incident.create({
        title: 'Assigned Incident',
        description: 'Testing assignment workflow',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        reporterId: citizenUser._id
      });

      await request(app)
        .patch(`/api/incidents/${incident._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedTo: officerUser._id })
        .expect(200);

      const officerIncidents = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      const assignedIncident = officerIncidents.body.find(inc => inc._id === incident._id.toString());
      expect(assignedIncident.assignedTo._id).toBe(officerUser._id.toString());
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent incident submissions', async () => {
      const incidentData = {
        title: 'Performance Test Incident',
        description: 'Testing concurrent submissions',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' }
      };

      const startTime = Date.now();
      const promises = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/incidents')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send({
            ...incidentData,
            title: `${incidentData.title} ${i}`
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const duration = endTime - startTime;
      console.log(`Concurrent incident submissions completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple concurrent GET requests efficiently', async () => {
      for (let i = 0; i < 20; i++) {
        await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: 'POACHING',
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id
        });
      }

      const startTime = Date.now();
      const promises = Array.from({ length: 20 }, () => 
        request(app)
          .get('/api/incidents/all')
          .set('Authorization', `Bearer ${officerToken}`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const duration = endTime - startTime;
      console.log(`Concurrent GET requests completed in ${duration}ms`);
      expect(duration).toBeLessThan(3000);
    });

    it('should maintain response time under load for incident creation', async () => {
      const incidentData = {
        title: 'Load Test Incident',
        description: 'Testing load performance',
        category: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' }
      };

      const times = [];
      for (let i = 0; i < 50; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/incidents')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send({
            ...incidentData,
            title: `${incidentData.title} ${i}`
          })
          .expect(201);
        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`Average incident creation time: ${avgTime}ms`);
      console.log(`Max incident creation time: ${maxTime}ms`);
      expect(avgTime).toBeLessThan(1000);
      expect(maxTime).toBeLessThan(5000);
    }, 60000);

    it('should handle large dataset queries efficiently', async () => {
      for (let i = 0; i < 100; i++) {
        await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: ['POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING', 'ANIMAL_CONFLICT'][i % 4],
          location: { lat: 12.3456 + (i * 0.0001), lng: 78.9012 + (i * 0.0001), address: `Address ${i}` },
          reporterId: citizenUser._id,
          status: ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'][i % 3]
        });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Query with 100 incidents completed in ${duration}ms`);
      expect(duration).toBeLessThan(1000);
      expect(response.body).toHaveLength(100);
    });

    it('should handle filtered queries efficiently', async () => {
      for (let i = 0; i < 100; i++) {
        await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: ['POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING', 'ANIMAL_CONFLICT'][i % 4],
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id,
          status: ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'][i % 3]
        });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/incidents/all?category=POACHING&status=IN_PROGRESS')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Filtered query completed in ${duration}ms`);
      expect(duration).toBeLessThan(500);
      response.body.forEach(incident => {
        expect(incident.category).toBe('POACHING');
        expect(incident.status).toBe('IN_PROGRESS');
      });
    });

    it('should handle concurrent status updates', async () => {
      const incidents = [];
      for (let i = 0; i < 10; i++) {
        const incident = await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: 'POACHING',
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id
        });
        incidents.push(incident);
      }

      const startTime = Date.now();
      const promises = incidents.map(incident =>
        request(app)
          .patch(`/api/incidents/${incident._id}/status`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ status: 'IN_PROGRESS' })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('IN_PROGRESS');
      });

      const duration = endTime - startTime;
      console.log(`Concurrent status updates completed in ${duration}ms`);
      expect(duration).toBeLessThan(3000);
    });

    it('should handle concurrent incident assignments', async () => {
      const incidents = [];
      for (let i = 0; i < 10; i++) {
        const incident = await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: 'POACHING',
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id
        });
        incidents.push(incident);
      }

      const startTime = Date.now();
      const promises = incidents.map(incident =>
        request(app)
          .patch(`/api/incidents/${incident._id}/assign`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ assignedTo: officerUser._id })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.assignedTo).toBe(officerUser._id.toString());
      });

      const duration = endTime - startTime;
      console.log(`Concurrent assignments completed in ${duration}ms`);
      expect(duration).toBeLessThan(3000);
    });

    it('should maintain performance with pagination', async () => {
      for (let i = 0; i < 100; i++) {
        await Incident.create({
          title: `Incident ${i}`,
          description: `Description ${i}`,
          category: 'POACHING',
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          reporterId: citizenUser._id
        });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/incidents/all')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Retrieved ${response.body.length} incidents in ${duration}ms`);
      expect(duration).toBeLessThan(1000);
      expect(response.body.length).toBe(100);
    }, 60000);
  });
});
