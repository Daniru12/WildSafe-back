const mongoose = require('mongoose');
const Incident = require('./models/Incident');
const User = require('./models/User');
require('dotenv').config();

async function createTestIncidents() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find or create admin user
        let adminUser = await User.findOne({ role: 'ADMIN' });
        if (!adminUser) {
            console.log('No admin user found. Creating one...');
            const admin = new User({
                name: 'Admin User',
                email: 'admin@test.com',
                password: 'admin123',
                role: 'ADMIN'
            });
            adminUser = await admin.save();
            console.log('Admin user created');
        }

        // Find or create citizen user
        let citizenUser = await User.findOne({ role: 'CITIZEN' });
        if (!citizenUser) {
            console.log('No citizen user found. Creating one...');
            const citizen = new User({
                name: 'Test Citizen',
                email: 'citizen@test.com',
                password: 'citizen123',
                role: 'CITIZEN'
            });
            citizenUser = await citizen.save();
            console.log('Citizen user created');
        }

        // Create multiple test incidents
        const testIncidents = [
            {
                title: 'Illegal Logging in Forest Reserve',
                description: 'Multiple trees cut down illegally in the northern forest reserve. Saw equipment and logs found on site.',
                category: 'ILLEGAL_LOGGING',
                reporterId: citizenUser._id,
                location: {
                    lat: 6.9271,
                    lng: 79.8612,
                    address: 'Northern Forest Reserve, Colombo'
                },
                status: 'SUBMITTED',
                priority: 'HIGH'
            },
            {
                title: 'Forest Fire Near Wildlife Sanctuary',
                description: 'Small forest fire detected near the eastern wildlife sanctuary. Smoke visible from main road.',
                category: 'FOREST_FIRE',
                reporterId: citizenUser._id,
                location: {
                    lat: 6.8900,
                    lng: 79.8500,
                    address: 'Eastern Wildlife Sanctuary'
                },
                status: 'UNDER_REVIEW',
                priority: 'CRITICAL'
            },
            {
                title: 'Suspected Poaching Activity',
                description: 'Gunshots heard and suspicious footprints found near the protected area overnight.',
                category: 'POACHING',
                reporterId: citizenUser._id,
                location: {
                    lat: 6.9500,
                    lng: 79.8700,
                    address: 'Protected Zone A'
                },
                status: 'IN_PROGRESS',
                priority: 'HIGH'
            },
            {
                title: 'Elephant Conflict in Village',
                description: 'Wild elephant entering village area, damaging crops. Immediate intervention needed.',
                category: 'ANIMAL_CONFLICT',
                reporterId: citizenUser._id,
                location: {
                    lat: 6.9100,
                    lng: 79.8400,
                    address: 'Village Area B'
                },
                status: 'RESOLVED',
                priority: 'MEDIUM'
            },
            {
                title: 'Trapped Injured Leopard',
                description: 'Young leopard found trapped in snare, injured leg. Needs immediate rescue.',
                category: 'TRAPPED_INJURED_ANIMAL',
                reporterId: citizenUser._id,
                location: {
                    lat: 6.9300,
                    lng: 79.8600,
                    address: 'Forest Area C'
                },
                status: 'SUBMITTED',
                priority: 'CRITICAL'
            }
        ];

        // Clear existing incidents
        await Incident.deleteMany({});
        console.log('Cleared existing incidents');

        // Insert test incidents
        const insertedIncidents = await Incident.insertMany(testIncidents);
        console.log(`Created ${insertedIncidents.length} test incidents`);

        // Check total incidents
        const totalIncidents = await Incident.countDocuments();
        console.log('Total incidents in database:', totalIncidents);

        mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        mongoose.connection.close();
    }
}

createTestIncidents();
