const multer = require('multer');
const { BadRequestError } = require('../errors/AppError');

// Configure storage to use memory
const storage = multer.memoryStorage();

// File filter to only allow images
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Type de fichier invalide. Seules les images sont autorisées.'), false);
  }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Type de fichier invalide. PDF, images ou documents Word autorisés.'), false);
  }
};

// Configure multer for images with size limit
const uploadImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Max 5 files
  },
  fileFilter: imageFilter
});

// Configure multer for documents with size limit
const uploadDocuments = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file only
  },
  fileFilter: documentFilter
});

module.exports = {
  uploadImages,
  uploadDocuments
};
