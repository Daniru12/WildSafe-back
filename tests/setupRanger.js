/**
 * Setup for ranger tests only. Used via Jest project so afterEach does NOT wipe
 * cases/rangermissions/threatreports, allowing ranger tests to create data and use it.
 */
require('dotenv').config();
const mongoose = require('mongoose');

let connected = false;

beforeAll(async () => {
  if (process.env.SKIP_DB === 'true') return;
  try {
    const mongoUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wildsafe_test';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
  } catch (err) {
    console.warn('⚠  MongoDB not reachable – skipping DB setup');
  }
});

afterAll(async () => {
  if (connected) {
    await mongoose.disconnect();
  }
});

afterEach(async () => {
  if (!connected) return;
  // Do NOT clean cases, rangermissions, threatreports so ranger tests can create and use them in the same run.
  const collections = mongoose.connection.collections;
  const collectionsToClean = ['incidents', 'assignments', 'notifications', 'resources', 'staff'];
  for (const key in collections) {
    if (collectionsToClean.includes(key.toLowerCase())) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});
