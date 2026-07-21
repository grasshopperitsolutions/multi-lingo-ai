/**
 * getImageService.js
 *
 * Generic image generation service using Gemini Imagen.
 * UI-agnostic — contains no exam logic.
 *
 * Generates images using the `imagen-4.0-fast-generate-001` model,
 * stores them to Firebase Storage, and optionally links them to
 * existing wordPool concepts in Firestore.
 *
 * Usage:
 *   import { generateImage, generateAndStoreImage } from '../services/getImageService';
 *
 *   // Simple generation (returns base64)
 *   const { imageData, mimeType } = await generateImage({ token, prompt: 'um gato' });
 *
 *   // Generate, upload to storage, and link to a wordPool concept
 *   const result = await generateAndStoreImage({
 *     token,
 *     prompt: 'um gato',
 *     conceptId: 'abc123',
 *     sourceWord: 'cat',
 *   });
 *
 *   // Search for an existing image by source word
 *   const existing = await findImageBySourceWord(token, 'cat');
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

import { askAI } from './aiService';

const IMAGEN_MODEL = 'imagen-4.0-fast-generate-001';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateImageResult
 * @property {string} imageData - Base64-encoded image data
 * @property {string} mimeType  - MIME type of the image (e.g. 'image/png')
 */

/**
 * @typedef {Object} GeneratedAndStoredImageResult
 * @property {string} imageData  - Base64-encoded image data
 * @property {string} mimeType   - MIME type
 * @property {string} publicUrl  - Public URL of the stored image
 * @property {string} fileId     - Firestore file document ID
 * @property {string} conceptId  - Associated wordPool concept ID (if provided)
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an image using Gemini Imagen.
 * Returns base64-encoded image data — does NOT store anything.
 *
 * @param {Object} params
 * @param {string} params.token  - Firebase ID token
 * @param {string} params.prompt - Text description for the image
 * @returns {Promise<GenerateImageResult>}
 */
export async function generateImage({ token, prompt }) {
  if (!token) throw new Error('[getImageService] token is required');
  if (!prompt?.trim()) throw new Error('[getImageService] prompt is required');

  let result;
  try {
    result = await askAI(token, prompt.trim(), {
      provider: 'gemini',
      model: IMAGEN_MODEL,
      // Imagen does not use temperature/jsonMode in the same way as text models
      // The response will be base64 image data
    });
  } catch (err) {
    console.error('[getImageService] Request failed', err);
    throw err;
  }

  if (!result?.imageData) {
    console.error('[getImageService] No image data in response', result);
    throw new Error('No image data returned from AI');
  }

  return {
    imageData: result.imageData,
    mimeType: result.mimeType || 'image/png',
  };
}

/**
 * Generate an image, upload it to Firebase Storage, and optionally link it to
 * a wordPool concept in Firestore.
 *
 * @param {Object} params
 * @param {string}  params.token       - Firebase ID token
 * @param {string}  params.prompt      - Text description for the image
 * @param {string}  [params.conceptId] - Optional wordPool concept ID to link the image to
 * @param {string}  [params.sourceWord]- Optional English source word for lookup
 * @returns {Promise<GeneratedAndStoredImageResult>}
 */
export async function generateAndStoreImage({ token, prompt, conceptId, sourceWord }) {
  // 1. Generate the image
  const { imageData, mimeType } = await generateImage({ token, prompt });

  // 2. Convert base64 to a Blob for storage upload
  const byteString = atob(imageData);
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });

  // 3. Determine file name
  const safePrompt = prompt
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 50);
  const fileName = `img_${safePrompt}_${Date.now()}.png`;
  const folder = conceptId
    ? `examImages/${conceptId}`
    : `examImages/generated`;

  // 4. Request signed upload URL
  // We need to requestUpload and then upload the blob
  const { requestUpload } = await import('./storageService');
  const uploadResult = await requestUpload(token, fileName, mimeType, folder, {
    prompt,
    conceptId: conceptId || null,
    sourceWord: sourceWord || null,
    generatedAt: new Date().toISOString(),
  });

  // 5. Upload the blob to GCS
  const { uploadToGcs } = await import('./storageService');
  await uploadToGcs(uploadResult.uploadUrl, blob, mimeType);

  // 6. If conceptId was provided, link the image to the wordPool concept
  if (conceptId) {
    await _linkImageToConcept(token, conceptId, uploadResult.publicUrl, uploadResult.fileId);
  }

  return {
    imageData,
    mimeType,
    publicUrl: uploadResult.publicUrl,
    fileId: uploadResult.fileId,
    conceptId: conceptId || null,
  };
}

/**
 * Search for existing images linked to a wordPool concept by source word.
 *
 * @param {string} token      - Firebase ID token
 * @param {string} sourceWord - English source word to search for (e.g. 'cat')
 * @returns {Promise<{ fileId: string, publicUrl: string, prompt: string }|null>}
 */
export async function findImageBySourceWord(token, sourceWord) {
  if (!token || !sourceWord?.trim()) return null;

  try {
    // Query the storage metadata or Firestore images collection
    const { queryCollection } = await import('./firestoreService');

    const result = await queryCollection(
      'examImages',
      { sourceWord: sourceWord.trim().toLowerCase() },
      { limit: 1 },
      token
    );

    if (result?.documents?.length > 0) {
      const doc = result.documents[0];
      return {
        fileId: doc.id,
        publicUrl: doc.data?.publicUrl || '',
        prompt: doc.data?.prompt || '',
      };
    }

    return null;
  } catch (err) {
    console.warn('[getImageService] findImageBySourceWord failed:', err.message);
    return null;
  }
}

/**
 * Fetch an existing image by its file ID from storage.
 *
 * @param {string} token  - Firebase ID token
 * @param {string} fileId - Firestore file document ID
 * @returns {Promise<{ signedUrl: string, fileName: string, contentType: string }|null>}
 */
export async function getImageByFileId(token, fileId) {
  if (!token || !fileId) return null;

  try {
    const { getSignedUrl } = await import('./storageService');
    return await getSignedUrl(token, fileId);
  } catch (err) {
    console.warn('[getImageService] getImageByFileId failed:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Link a generated image to a wordPool concept by updating the concept's
 * Firestore document with the image URL.
 */
async function _linkImageToConcept(token, conceptId, publicUrl, fileId) {
  try {
    const { patchDocument } = await import('./firestoreService');

    await patchDocument(
      'wordPool',
      conceptId,
      {
        imageUrl: publicUrl,
        imageFileId: fileId,
        updatedAt: new Date().toISOString(),
      },
      token
    );
  } catch (err) {
    console.warn('[getImageService] Failed to link image to concept:', err.message);
    // Non-fatal — image was still generated and stored
  }
}