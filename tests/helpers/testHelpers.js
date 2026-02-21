const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Incident = require('../../models/Incident');

/**
 * Create a test user with specified role
 */
const createTestUser = async (userData) => {
  const user = await User.create(userData);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test_secret');
  return { user, token };
};

/**
 * Create test users for all roles
 */
const createTestUsers = async () => {
  const citizen = await createTestUser({
    name: 'Test Citizen',
    email: 'citizen@test.com',
    password: 'password123',
    role: 'CITIZEN'
  });

  const officer = await createTestUser({
    name: 'Test Officer',
    email: 'officer@test.com',
    password: 'password123',
    role: 'OFFICER'
  });

  const admin = await createTestUser({
    name: 'Test Admin',
    email: 'admin@test.com',
    password: 'password123',
    role: 'ADMIN'
  });

  return { citizen, officer, admin };
};

/**
 * Create a test incident
 */
const createTestIncident = async (incidentData, reporterId) => {
  const defaultData = {
    title: 'Test Incident',
    description: 'This is a test incident description',
    category: 'POACHING',
    location: {
      lat: 12.3456,
      lng: 78.9012,
      address: 'Test Address'
    },
    reporterId
  };

  return await Incident.create({ ...defaultData, ...incidentData });
};

/**
 * Create multiple test incidents
 */
const createTestIncidents = async (count, reporterId) => {
  const incidents = [];
  for (let i = 0; i < count; i++) {
    incidents.push({
      title: `Test Incident ${i + 1}`,
      description: `Description for incident ${i + 1}`,
      category: ['POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING', 'ANIMAL_CONFLICT'][i % 4],
      location: {
        lat: 12.3456 + (i * 0.001),
        lng: 78.9012 + (i * 0.001)
      },
      reporterId,
      status: ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'][i % 4]
    });
  }
  return await Incident.create(incidents);
};

/**
 * Clean up all test data
 */
const cleanupTestData = async () => {
  await Promise.all([
    User.deleteMany({}),
    Incident.deleteMany({})
  ]);
};

/**
 * Generate a valid incident data object
 */
const generateValidIncidentData = (overrides = {}) => {
  return {
    title: 'Test Incident',
    description: 'This is a test incident description',
    category: 'POACHING',
    location: {
      lat: 12.3456,
      lng: 78.9012,
      address: 'Test Address'
    },
    ...overrides
  };
};

/**
 * Valid incident categories
 */
const VALID_CATEGORIES = ['ILLEGAL_LOGGING', 'FOREST_FIRE', 'POACHING', 'ANIMAL_CONFLICT', 'TRAPPED_INJURED_ANIMAL', 'OTHER'];

/**
 * Valid incident statuses
 */
const VALID_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/**
 * Valid incident priorities
 */
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

module.exports = {
  createTestUser,
  createTestUsers,
  createTestIncident,
  createTestIncidents,
  cleanupTestData,
  generateValidIncidentData,
  VALID_CATEGORIES,
  VALID_STATUSES,
  VALID_PRIORITIES
};
