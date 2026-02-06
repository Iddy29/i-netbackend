const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * Upload a base64 image to imgBB
 * @param {string} base64Image - Base64-encoded image string (without data URI prefix)
 * @param {string} name - Optional name for the image
 * @returns {Promise<{url: string, deleteUrl: string, thumbnail: string}>}
 */
const uploadImage = async (base64Image, name = 'profile') => {
  if (!IMGBB_API_KEY) {
    throw new Error('IMGBB_API_KEY is not configured');
  }

  // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  const formData = new URLSearchParams();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', cleanBase64);
  formData.append('name', name);

  const response = await fetch(IMGBB_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to upload image to imgBB');
  }

  return {
    url: result.data.url,
    displayUrl: result.data.display_url,
    thumbnail: result.data.thumb?.url || result.data.display_url,
    deleteUrl: result.data.delete_url,
  };
};

module.exports = { uploadImage };
