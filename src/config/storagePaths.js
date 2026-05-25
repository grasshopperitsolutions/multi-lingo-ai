/**
 * GCS path builders — single source of truth for all storage path conventions.
 *
 * Rules:
 *  - Folder paths (used for prefix-based deletes) must end with '/'
 *  - No component of this file should import from services or have side effects
 *  - Add a new entry here whenever a new storage folder is introduced
 */
export const storagePaths = {
  /**
   * Folder that holds all avatar images for a given user.
   * @param {string} uid
   * @returns {string} e.g. 'avatars/WgY6BW7Pi3OY/'
   */
  avatarFolder: (uid) => `avatars/${uid}/`,
};
