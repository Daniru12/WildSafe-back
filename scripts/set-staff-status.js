require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const Staff = require(path.join(__dirname, '..', 'models', 'resourceStaff', 'Staff'));

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set in environment');
        process.exit(1);
    }

    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        const result = await Staff.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'AVAILABLE' } }
        );
        console.log('Matched:', result.matchedCount || result.n || 0);
        console.log('Modified:', result.modifiedCount || result.nModified || 0);
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
