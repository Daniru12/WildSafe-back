const multer = require('multer');
const { storage } = require('../config/cloudinary');

// Configure multer for image upload
let upload;
if (storage) {
    // Use Cloudinary storage if available
    upload = multer({
        storage: storage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        },
        fileFilter: (req, file, cb) => {
            // Check if the file is an image
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    });
} else {
    // Use memory storage if Cloudinary is not configured
    const memoryStorage = multer.memoryStorage();
    upload = multer({
        storage: memoryStorage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        },
        fileFilter: (req, file, cb) => {
            // Check if the file is an image
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    });
}

// Single image upload middleware
const uploadSingle = upload.single('image');

// Multiple images upload middleware (max 5 images)
const uploadMultiple = upload.array('images', 5);

module.exports = {
    uploadSingle,
    uploadMultiple
};
