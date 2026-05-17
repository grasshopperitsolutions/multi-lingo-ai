const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Request a signed GCS upload URL from the API.
 *
 * POST /api/storage
 *
 * @param {string} token       - Firebase ID token
 * @param {string} fileName    - Original file name
 * @param {string} contentType - MIME type (e.g. 'image/jpeg')
 * @param {string} [folder]    - Storage folder prefix (default: 'uploads')
 * @param {Object} [metadata]  - Optional key/value metadata to store
 * @returns {Promise<{ fileId: string, uploadUrl: string, filePath: string, publicUrl: string }>}
 */
export const requestUpload = async (token, fileName, contentType, folder = 'uploads', metadata = {}) => {
  const res = await fetch(`${PROXY_URL}/api/storage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName, contentType, folder, metadata }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to request upload URL');
  // API wraps response in { data: { ... } } via successResponse
  return json?.data || json;
};

/**
 * Upload a File/Blob directly to GCS using a pre-signed URL.
 * This is a direct GCS call — no Authorization header needed.
 *
 * @param {string}      signedUrl   - The signed PUT URL from requestUpload
 * @param {File|Blob}   file        - The file or blob to upload
 * @param {string}      contentType - Must match the MIME type used in requestUpload
 * @returns {Promise<void>}
 */
export const uploadToGcs = async (signedUrl, file, contentType) => {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) throw new Error('Failed to upload file to storage');
};

/**
 * Get a short-lived signed download URL for a stored file.
 *
 * GET /api/storage?fileId=<fileId>[&expiresIn=<seconds>]
 *
 * @param {string} token              - Firebase ID token
 * @param {string} fileId             - The Firestore file document ID
 * @param {number} [expiresIn=3600]   - URL lifetime in seconds (default: 1 hour)
 * @returns {Promise<{ signedUrl: string, fileName: string, contentType: string, expiresAt: string }>}
 */
export const getSignedUrl = async (token, fileId, expiresIn = 3600) => {
  const res = await fetch(
    `${PROXY_URL}/api/storage?fileId=${encodeURIComponent(fileId)}&expiresIn=${expiresIn}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to get signed URL');
  return json?.data || json;
};

/**
 * Update metadata (and optionally rename) a stored file.
 *
 * PUT /api/storage
 *
 * @param {string}  token              - Firebase ID token
 * @param {string}  fileId             - The Firestore file document ID
 * @param {Object}  [updates]          - Fields to update
 * @param {string}  [updates.fileName] - New file name (triggers GCS rename)
 * @param {string}  [updates.contentType]
 * @param {Object}  [updates.metadata] - Merged into existing metadata
 * @returns {Promise<{ fileId: string, filePath: string, publicUrl: string }>}
 */
export const updateFileMetadata = async (token, fileId, updates = {}) => {
  const res = await fetch(`${PROXY_URL}/api/storage`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, ...updates }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to update file metadata');
  return json?.data || json;
};

/**
 * Permanently delete a stored file from GCS and its Firestore record.
 *
 * DELETE /api/storage
 *
 * @param {string} token   - Firebase ID token
 * @param {string} fileId  - The Firestore file document ID
 * @returns {Promise<{ message: string, fileId: string }>}
 */
export const deleteFile = async (token, fileId) => {
  const res = await fetch(`${PROXY_URL}/api/storage`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to delete file');
  return json?.data || json;
};
