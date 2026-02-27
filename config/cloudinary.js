const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Check if Cloudinary credentials are available
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary credentials not found. Image upload will be disabled.');
    module.exports = {
        cloudinary: null,
        storage: null,
        rangerStorage: null
    };
} else {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Storage for incident uploads
    const storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'wildsafe-incidents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        public_id: (req, file) => `incident-${Date.now()}-${file.originalname}`,
        resource_type: 'auto'
      }
    });

    // Storage for ranger evidence uploads (photos/videos)
    const rangerStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'wildsafe-ranger',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'],
        public_id: (req, file) => `ranger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        resource_type: 'auto'
      }
    });

    module.exports = {
      cloudinary,
      storage,
      rangerStorage
    };
}
