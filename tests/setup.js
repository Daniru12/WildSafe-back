const mongoose = require('mongoose');

beforeAll(async () => {
  // Use test database or in-memory database
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/wildsafe_test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  // Only clean up incident-related collections to preserve test users
  const collections = mongoose.connection.collections;
  const collectionsToClean = ['incidents', 'threatreports', 'cases', 'assignments', 'notifications', 'resources', 'staff'];
  
  for (const key in collections) {
    if (collectionsToClean.includes(key.toLowerCase())) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});
