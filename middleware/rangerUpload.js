const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { rangerStorage } = require('../config/cloudinary');

const uploadDir = path.join(__dirname, '..', 'uploads', 'ranger');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /^image\//.test(file.mimetype) || /^video\//.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only image or video files allowed'), false);
};

const limits = { fileSize: 10 * 1024 * 1024 }; // 10MB

const rangerEvidenceUpload = rangerStorage
    ? multer({ storage: rangerStorage, limits, fileFilter }).array('photos', 10)
    : multer({ storage: diskStorage, limits, fileFilter }).array('photos', 10);

module.exports = { rangerEvidenceUpload };
