const cloudinary = require('cloudinary').v2;

/**
 * Upload a single file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} mimetype - File mimetype
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<string>} - Secure URL of uploaded file
 */
async function uploadSingleFile(fileBuffer, mimetype, folder) {
  const b64 = Buffer.from(fileBuffer).toString('base64');
  const dataURI = `data:${mimetype};base64,${b64}`;
  
  const result = await cloudinary.uploader.upload(dataURI, {
    folder,
    resource_type: 'auto',
  });
  
  return result.secure_url;
}

/**
 * Upload multiple files to Cloudinary
 * @param {Array} files - Array of multer file objects
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<Array<string>>} - Array of secure URLs
 */
async function uploadMultipleFiles(files, folder) {
  const uploadPromises = files.map(file => 
    uploadSingleFile(file.buffer, file.mimetype, folder)
  );
  
  return Promise.all(uploadPromises);
}

/**
 * Delete a file from Cloudinary by public_id
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Extract public_id from Cloudinary URL
 * @param {string} url - Cloudinary secure URL
 * @returns {string} - Public ID
 */
function extractPublicId(url) {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  const publicId = filename.split('.')[0];
  
  // Include folder path
  const folderStartIndex = parts.indexOf('g-house');
  if (folderStartIndex !== -1) {
    const folderPath = parts.slice(folderStartIndex, -1).join('/');
    return `${folderPath}/${publicId}`;
  }
  
  return publicId;
}

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  deleteFile,
  extractPublicId,
};
