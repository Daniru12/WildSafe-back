const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const ThreatReport = require('../models/ThreatReport');
const Case = require('../models/Case');

describe('Threat Report Controller Tests', () => {
  // ============================================
  // INTEGRATION TESTS
  // These tests verify the complete API endpoints
  // including authentication, validation, and database operations
  // ============================================
  let citizenToken, officerToken, adminToken;
  let citizenUser, officerUser, adminUser;
  let testThreatReport;

  beforeAll(async () => {
    await User.deleteMany({});
    
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

    citizenToken = jwt.sign({ id: citizenUser._id.toString(), email: citizenUser.email }, process.env.JWT_SECRET || 'test_secret');
    officerToken = jwt.sign({ id: officerUser._id.toString(), email: officerUser.email, role: officerUser.role }, process.env.JWT_SECRET || 'test_secret');
    adminToken = jwt.sign({ id: adminUser._id.toString(), email: adminUser.email, role: adminUser.role }, process.env.JWT_SECRET || 'test_secret');
    
    console.log('Test users created and tokens generated');
  });

  beforeEach(async () => {
    await ThreatReport.deleteMany({});
    await Case.deleteMany({});
  });

  // Integration Tests - POST /api/threat-reports
  // Tests the threat report creation endpoint with various scenarios
  describe('POST /api/threat-reports - Integration Tests', () => {
    const threatReportData = {
      threatType: 'POACHING',
      location: {
        lat: 12.3456,
        lng: 78.9012,
        address: 'Test Address'
      },
      dateTime: new Date().toISOString(),
      description: 'This is a test threat report description',
      reporterInfo: {
        name: 'Test Reporter',
        email: 'reporter@test.com',
        phone: '+1234567890',
        isAnonymous: false
      },
      media: [
        {
          url: 'https://example.com/image1.jpg',
          mediaType: 'IMAGE'
        }
      ],
      urgencyLevel: 'HIGH'
    };

    it('should create a new threat report with valid data', async () => {
      const response = await request(app)
        .post('/api/threat-reports')
        .send(threatReportData)
        .expect(201);

      expect(response.body).toHaveProperty('reportId');
      expect(response.body.reportId).toMatch(/^TR-/);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.message).toContain('submitted successfully');

      const savedReport = await ThreatReport.findOne({ reportId: response.body.reportId });
      expect(savedReport).toBeTruthy();
      expect(savedReport.threatType).toBe(threatReportData.threatType);
      expect(savedReport.reporterInfo.email).toBe(threatReportData.reporterInfo.email);
    });

    it('should create threat report with string media URLs', async () => {
      const dataWithStringMedia = {
        ...threatReportData,
        media: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(dataWithStringMedia)
        .expect(201);

      const savedReport = await ThreatReport.findOne({ reportId: response.body.reportId });
      expect(savedReport.media).toHaveLength(2);
      expect(savedReport.media[0].mediaType).toBe('IMAGE');
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteData = {
        threatType: 'POACHING',
        location: {
          lat: 12.3456,
          lng: 78.9012,
          address: 'Test Address'
        }
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(incompleteData)
        .expect(400);

      expect(response.body.message).toContain('Missing required fields');
    });

    it('should return 400 with invalid location data', async () => {
      const invalidLocationData = {
        ...threatReportData,
        location: {
          lat: 91,
          lng: 78.9012
        }
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(invalidLocationData)
        .expect(400);

      expect(response.body.message).toContain('Invalid location data');
    });

    it('should return 400 with missing reporter name', async () => {
      const invalidReporterData = {
        ...threatReportData,
        reporterInfo: {
          email: 'reporter@test.com'
        }
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(invalidReporterData)
        .expect(400);

      expect(response.body.message).toContain('Reporter name is required');
    });

    it('should set default urgency level to MEDIUM', async () => {
      const dataWithoutUrgency = {
        ...threatReportData,
        urgencyLevel: undefined
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(dataWithoutUrgency)
        .expect(201);

      const savedReport = await ThreatReport.findOne({ reportId: response.body.reportId });
      expect(savedReport.urgencyLevel).toBe('MEDIUM');
    });

    it('should handle multiple media items with different types', async () => {
      const dataWithMixedMedia = {
        ...threatReportData,
        media: [
          { url: 'https://example.com/image.jpg', mediaType: 'IMAGE' },
          { url: 'https://example.com/video.mp4', mediaType: 'VIDEO' }
        ]
      };

      const response = await request(app)
        .post('/api/threat-reports')
        .send(dataWithMixedMedia)
        .expect(201);

      const savedReport = await ThreatReport.findOne({ reportId: response.body.reportId });
      expect(savedReport.media).toHaveLength(2);
      expect(savedReport.media[0].mediaType).toBe('IMAGE');
      expect(savedReport.media[1].mediaType).toBe('VIDEO');
    });
  });

  // Integration Tests - GET /api/threat-reports/mine
  // Tests retrieving threat reports for the logged-in user
  describe('GET /api/threat-reports/mine - Integration Tests', () => {
    beforeEach(async () => {
      await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Address 1' },
        dateTime: new Date(),
        description: 'Description 1',
        reporterInfo: { name: 'Reporter 1', email: 'citizen@test.com' },
        status: 'PENDING'
      });

      await ThreatReport.create({
        reportId: 'TR-TEST-002',
        threatType: 'FOREST_FIRE',
        location: { lat: 12.3457, lng: 78.9013, address: 'Address 2' },
        dateTime: new Date(),
        description: 'Description 2',
        reporterInfo: { name: 'Reporter 2', email: 'citizen@test.com' },
        status: 'VALIDATED'
      });

      await ThreatReport.create({
        reportId: 'TR-TEST-003',
        threatType: 'ILLEGAL_LOGGING',
        location: { lat: 12.3458, lng: 78.9014, address: 'Address 3' },
        dateTime: new Date(),
        description: 'Description 3',
        reporterInfo: { name: 'Reporter 3', email: 'officer@test.com' },
        status: 'PENDING'
      });
    });

    it('should get all threat reports for the logged-in user', async () => {
      const response = await request(app)
        .get('/api/threat-reports/mine')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].reporterInfo.email).toBe('citizen@test.com');
      expect(response.body[1].reporterInfo.email).toBe('citizen@test.com');
    }, 60000);

    it('should filter threat reports by status', async () => {
      const response = await request(app)
        .get('/api/threat-reports/mine?status=VALIDATED')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('VALIDATED');
    });

    it('should filter threat reports by threat type', async () => {
      const response = await request(app)
        .get('/api/threat-reports/mine?threatType=POACHING')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].threatType).toBe('POACHING');
    });

    it('should paginate threat reports', async () => {
      const response = await request(app)
        .get('/api/threat-reports/mine?page=1&limit=1')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/threat-reports/mine')
        .expect(401);

      expect(response.body.message).toBe('No token, authorization denied');
    });
  });

  // Integration Tests - GET /api/threat-reports
  // Tests retrieving all threat reports with filtering capabilities
  describe('GET /api/threat-reports - Integration Tests', () => {
    beforeEach(async () => {
      await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Address 1' },
        dateTime: new Date(),
        description: 'Description 1',
        reporterInfo: { name: 'Reporter 1', email: 'reporter1@test.com' },
        status: 'PENDING'
      });

      await ThreatReport.create({
        reportId: 'TR-TEST-002',
        threatType: 'FOREST_FIRE',
        location: { lat: 12.3457, lng: 78.9013, address: 'Address 2' },
        dateTime: new Date(),
        description: 'Description 2',
        reporterInfo: { name: 'Reporter 2', email: 'reporter2@test.com' },
        status: 'VALIDATED'
      });
    });

    it('should allow officer to get all threat reports', async () => {
      const response = await request(app)
        .get('/api/threat-reports')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.reports).toHaveLength(2);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.total).toBe(2);
    });

    it('should allow admin to get all threat reports', async () => {
      const response = await request(app)
        .get('/api/threat-reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.reports).toHaveLength(2);
    });

    it('should return 403 for citizen trying to access all threat reports', async () => {
      const response = await request(app)
        .get('/api/threat-reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should filter threat reports by status', async () => {
      const response = await request(app)
        .get('/api/threat-reports?status=VALIDATED')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.reports).toHaveLength(1);
      expect(response.body.reports[0].status).toBe('VALIDATED');
    });

    it('should filter threat reports by threat type', async () => {
      const response = await request(app)
        .get('/api/threat-reports?threatType=POACHING')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.reports).toHaveLength(1);
      expect(response.body.reports[0].threatType).toBe('POACHING');
    });

    it('should paginate threat reports correctly', async () => {
      const response = await request(app)
        .get('/api/threat-reports?page=1&limit=1')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.reports).toHaveLength(1);
      expect(parseInt(response.body.pagination.current)).toBe(1);
      expect(parseInt(response.body.pagination.pages)).toBe(2);
    });
  });

  // Integration Tests - GET /api/threat-reports/:reportId
  // Tests retrieving a specific threat report by ID
  describe('GET /api/threat-reports/:reportId - Integration Tests', () => {
    beforeEach(async () => {
      testThreatReport = await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        dateTime: new Date(),
        description: 'Test description',
        reporterInfo: { name: 'Test Reporter', email: 'citizen@test.com' },
        status: 'PENDING'
      });
    });

    it('should allow reporter to view their own threat report', async () => {
      const response = await request(app)
        .get(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body.reportId).toBe(testThreatReport.reportId);
      expect(response.body.threatType).toBe(testThreatReport.threatType);
    });

    it('should allow officer to view any threat report', async () => {
      const response = await request(app)
        .get(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.reportId).toBe(testThreatReport.reportId);
    });

    it('should allow admin to view any threat report', async () => {
      const response = await request(app)
        .get(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.reportId).toBe(testThreatReport.reportId);
    });

    it('should return 404 for non-existent threat report', async () => {
      const response = await request(app)
        .get('/api/threat-reports/TR-NONEXISTENT')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(404);

      expect(response.body.message).toBe('Threat report not found');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get(`/api/threat-reports/${testThreatReport.reportId}`)
        .expect(401);

      expect(response.body.message).toBe('No token, authorization denied');
    });
  });

  // Integration Tests - PUT /api/threat-reports/:reportId/validate
  // Tests validating/rejecting threat reports by authorized users
  describe('PUT /api/threat-reports/:reportId/validate - Integration Tests', () => {
    beforeEach(async () => {
      testThreatReport = await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        dateTime: new Date(),
        description: 'Test description',
        reporterInfo: { name: 'Test Reporter', email: 'citizen@test.com' },
        status: 'PENDING'
      });
    });

    it('should allow officer to validate threat report', async () => {
      const response = await request(app)
        .put(`/api/threat-reports/${testThreatReport.reportId}/validate`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ 
          status: 'VALIDATED',
          validationNotes: 'Valid threat report'
        })
        .expect(200);

      expect(response.body.report.status).toBe('VALIDATED');
      expect(response.body.report.validationNotes).toBe('Valid threat report');

      const updatedReport = await ThreatReport.findOne({ reportId: testThreatReport.reportId });
      expect(updatedReport.status).toBe('VALIDATED');

      const createdCase = await Case.findOne({ threatReportId: testThreatReport._id });
      expect(createdCase).toBeTruthy();
      expect(createdCase.threatType).toBe('POACHING');
    });

    it('should allow admin to validate threat report', async () => {
      const response = await request(app)
        .put(`/api/threat-reports/${testThreatReport.reportId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'VALIDATED',
          validationNotes: 'Valid threat report'
        })
        .expect(200);

      expect(response.body.report.status).toBe('VALIDATED');
    });

    it('should allow officer to reject threat report', async () => {
      const response = await request(app)
        .put(`/api/threat-reports/${testThreatReport.reportId}/validate`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ 
          status: 'REJECTED',
          validationNotes: 'Invalid threat report'
        })
        .expect(200);

      expect(response.body.report.status).toBe('REJECTED');

      const createdCase = await Case.findOne({ threatReportId: testThreatReport._id });
      expect(createdCase).toBeFalsy();
    });

    it('should return 400 with invalid status', async () => {
      const response = await request(app)
        .put(`/api/threat-reports/${testThreatReport.reportId}/validate`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body.message).toContain('Invalid status');
    });

    it('should return 403 for citizen trying to validate threat report', async () => {
      const response = await request(app)
        .put(`/api/threat-reports/${testThreatReport.reportId}/validate`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: 'VALIDATED' })
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 404 for non-existent threat report', async () => {
      const response = await request(app)
        .put('/api/threat-reports/TR-NONEXISTENT/validate')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'VALIDATED' })
        .expect(404);

      expect(response.body.message).toBe('Threat report not found');
    });
  });

  // Integration Tests - GET /api/threat-reports/stats/overview
  // Tests retrieving threat report statistics
  describe('GET /api/threat-reports/stats/overview - Integration Tests', () => {
    beforeEach(async () => {
      await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Address 1' },
        dateTime: new Date(),
        description: 'Description 1',
        reporterInfo: { name: 'Reporter 1', email: 'reporter1@test.com' },
        status: 'PENDING',
        urgencyLevel: 'HIGH'
      });

      await ThreatReport.create({
        reportId: 'TR-TEST-002',
        threatType: 'POACHING',
        location: { lat: 12.3457, lng: 78.9013, address: 'Address 2' },
        dateTime: new Date(),
        description: 'Description 2',
        reporterInfo: { name: 'Reporter 2', email: 'reporter2@test.com' },
        status: 'VALIDATED',
        urgencyLevel: 'MEDIUM'
      });

      await ThreatReport.create({
        reportId: 'TR-TEST-003',
        threatType: 'FOREST_FIRE',
        location: { lat: 12.3458, lng: 78.9014, address: 'Address 3' },
        dateTime: new Date(),
        description: 'Description 3',
        reporterInfo: { name: 'Reporter 3', email: 'reporter3@test.com' },
        status: 'REJECTED',
        urgencyLevel: 'LOW'
      });
    });

    it('should allow officer to get threat report statistics', async () => {
      const response = await request(app)
        .get('/api/threat-reports/stats/overview')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('statusBreakdown');
      expect(response.body).toHaveProperty('threatTypeBreakdown');
      expect(response.body).toHaveProperty('urgencyBreakdown');
      expect(response.body.statusBreakdown).toHaveLength(3);
    });

    it('should allow admin to get threat report statistics', async () => {
      const response = await request(app)
        .get('/api/threat-reports/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.statusBreakdown).toBeTruthy();
    });

    it('should return 403 for citizen trying to access statistics', async () => {
      const response = await request(app)
        .get('/api/threat-reports/stats/overview')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });
  });

  // Integration Tests - DELETE /api/threat-reports/:reportId
  // Tests deleting threat reports by authorized users
  describe('DELETE /api/threat-reports/:reportId - Integration Tests', () => {
    beforeEach(async () => {
      testThreatReport = await ThreatReport.create({
        reportId: 'TR-TEST-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        dateTime: new Date(),
        description: 'Test description',
        reporterInfo: { name: 'Test Reporter', email: 'citizen@test.com' },
        status: 'PENDING'
      });
    });

    it('should allow admin to delete threat report', async () => {
      const response = await request(app)
        .delete(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted successfully');

      const deletedReport = await ThreatReport.findOne({ reportId: testThreatReport.reportId });
      expect(deletedReport).toBeFalsy();
    });

    it('should return 400 when trying to delete threat report with associated case', async () => {
      const associatedCase = await Case.create({
        caseId: 'CS-TEST-001',
        threatReportId: testThreatReport._id,
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        reporterInfo: { name: 'Test Reporter', email: 'citizen@test.com' },
        dateTime: new Date(),
        priority: 'HIGH'
      });

      const response = await request(app)
        .delete(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('Cannot delete threat report');
    });

    it('should return 403 for officer trying to delete threat report', async () => {
      const response = await request(app)
        .delete(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 403 for citizen trying to delete threat report', async () => {
      const response = await request(app)
        .delete(`/api/threat-reports/${testThreatReport.reportId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: insufficient permissions');
    });

    it('should return 404 for non-existent threat report', async () => {
      const response = await request(app)
        .delete('/api/threat-reports/TR-NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).toBe('Threat report not found');
    });
  });

  // ============================================
  // PERFORMANCE TESTS
  // These tests evaluate the speed, scalability, and
  // responsiveness of the API under various loads
  // ============================================
  describe('Performance Tests', () => {
    // Performance Test - Tests concurrent threat report creation under load
    it('should handle concurrent threat report submissions', async () => {
      const threatData = {
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        dateTime: new Date().toISOString(),
        description: 'Performance test description',
        reporterInfo: { name: 'Test Reporter', email: 'perf@test.com' }
      };

      const startTime = Date.now();
      const promises = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/threat-reports')
          .send({
            ...threatData,
            reporterInfo: { ...threatData.reporterInfo, email: `perf${i}@test.com` }
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const duration = endTime - startTime;
      console.log(`Concurrent submissions completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000);
    });

    // Performance Test - Tests concurrent read operations
    it('should handle multiple concurrent GET requests efficiently', async () => {
      await ThreatReport.create({
        reportId: 'TR-PERF-001',
        threatType: 'POACHING',
        location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
        dateTime: new Date(),
        description: 'Performance test description',
        reporterInfo: { name: 'Test Reporter', email: 'perf@test.com' }
      });

      const startTime = Date.now();
      const promises = Array.from({ length: 20 }, () => 
        request(app)
          .get('/api/threat-reports')
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

    // Performance Test - Tests pagination performance with large dataset
    it('should maintain response time under load for pagination', async () => {
      for (let i = 0; i < 50; i++) {
        await ThreatReport.create({
          reportId: `TR-PERF-${i.toString().padStart(3, '0')}`,
          threatType: 'POACHING',
          location: { lat: 12.3456 + (i * 0.0001), lng: 78.9012 + (i * 0.0001), address: `Address ${i}` },
          dateTime: new Date(),
          description: `Description ${i}`,
          reporterInfo: { name: `Reporter ${i}`, email: `perf${i}@test.com` }
        });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/threat-reports?page=1&limit=10')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Pagination with 50 records completed in ${duration}ms`);
      expect(duration).toBeLessThan(1000);
      expect(response.body.reports).toHaveLength(10);
    });

    // Performance Test - Tests statistics aggregation performance with 100 records
    it('should handle statistics aggregation efficiently', async () => {
      for (let i = 0; i < 100; i++) {
        await ThreatReport.create({
          reportId: `TR-STATS-${i.toString().padStart(3, '0')}`,
          threatType: ['POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING'][i % 3],
          location: { lat: 12.3456, lng: 78.9012, address: 'Test Address' },
          dateTime: new Date(),
          description: `Description ${i}`,
          reporterInfo: { name: `Reporter ${i}`, email: `stats${i}@test.com` },
          status: ['PENDING', 'VALIDATED', 'REJECTED'][i % 3],
          urgencyLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4]
        });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/threat-reports/stats/overview')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`Statistics aggregation with 100 records completed in ${duration}ms`);
      expect(duration).toBeLessThan(2000);
      expect(response.body.statusBreakdown).toHaveLength(3);
    }, 60000);
  });
});
