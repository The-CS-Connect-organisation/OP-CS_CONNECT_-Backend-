/**
 * Unique ID generation utilities
 * Use crypto.randomUUID() when available, fallback to timestamp + random
 */

/**
 * Generate a unique ID string
 * @returns {string} Unique ID
 */
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node.js versions
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Generate a short unique ID (for smaller collision risk scenarios)
 * @returns {string} Short unique ID
 */
export const generateShortId = () => {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

export default { generateId, generateShortId };