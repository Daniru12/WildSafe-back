require('dotenv').config();
const mongoose = require('mongoose');

let connected = false;

beforeAll(async () => {
  // Skip DB connection for pure unit tests (models are jest.mock-ed)
  if (process.env.SKIP_DB === 'true') return;

  try {
    const mongoUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wildsafe_test';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
  } catch (err) {
    console.warn('⚠  MongoDB not reachable – skipping DB setup (unit-test mode)');
  }
});

afterAll(async () => {
  if (connected) {
    await mongoose.disconnect();
  }
});

afterEach(async () => {
  if (!connected) return;

  // Only clean up incident-related collections to preserve test users
  const collections = mongoose.connection.collections;
  const collectionsToClean = ['incidents', 'threatreports', 'cases', 'rangermissions', 'assignments', 'notifications', 'resources', 'staff'];
  
  for (const key in collections) {
    if (collectionsToClean.includes(key.toLowerCase())) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});
