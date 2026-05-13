/**
 * Firebase Realtime Database utility functions
 * Provides a consistent interface for database operations
 */

import { db } from '../config/firebase.js';
import { logger } from './logger.js';

/**
 * Get a single record by ID
 * @param {string} path - Database path (e.g., 'users/userId')
 * @returns {Promise<Object|null>}
 */
export const getRecord = async (path) => {
  try {
    const snapshot = await db.ref(path).once('value');
    return snapshot.val();
  } catch (error) {
    logger.error('Error getting record', { path, error: error.message });
    throw error;
  }
};

/**
 * Get multiple records from a path
 * @param {string} path - Database path (e.g., 'users')
 * @param {Object} options - Query options { orderBy, limitToFirst, limitToLast, equalTo, startAt, endAt }
 * @returns {Promise<Array>}
 */
export const getRecords = async (path, options = {}) => {
  try {
    let query = db.ref(path);

    if (options.orderBy) {
      query = query.orderByChild(options.orderBy);
    }

    if (options.equalTo !== undefined) {
      query = query.equalTo(options.equalTo);
    }

    if (options.startAt !== undefined) {
      query = query.startAt(options.startAt);
    }

    if (options.endAt !== undefined) {
      query = query.endAt(options.endAt);
    }

    if (options.limitToFirst) {
      query = query.limitToFirst(options.limitToFirst);
    }

    if (options.limitToLast) {
      query = query.limitToLast(options.limitToLast);
    }

    const snapshot = await query.once('value');
    const data = snapshot.val();

    if (!data) return [];

    // Convert object to array with id field
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...value,
    }));
  } catch (error) {
    logger.error('Error getting records', { path, error: error.message });
    throw error;
  }
};

/**
 * Create a new record
 * @param {string} path - Database path (e.g., 'users')
 * @param {Object} data - Record data
 * @returns {Promise<Object>} - Created record with id
 */
export const createRecord = async (path, data) => {
  try {
    const ref = db.ref(path).push();
    const id = ref.key;
    await ref.set({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { id, ...data };
  } catch (error) {
    logger.error('Error creating record', { path, error: error.message });
    throw error;
  }
};

/**
 * Update a record
 * @param {string} path - Database path (e.g., 'users/userId')
 * @param {Object} data - Data to update
 * @returns {Promise<Object>}
 */
export const updateRecord = async (path, data) => {
  try {
    // Check if record exists
    const snapshot = await db.ref(path).once('value');
    const exists = snapshot.exists();
    
    if (exists) {
      // Record exists, use update
      await db.ref(path).update({
        ...data,
        updated_at: new Date().toISOString(),
      });
    } else {
      // Record doesn't exist, use set
      await db.ref(path).set({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    
    const updatedSnapshot = await db.ref(path).once('value');
    return updatedSnapshot.val();
  } catch (error) {
    logger.error('Error updating record', { path, error: error.message });
    throw error;
  }
};

/**
 * Delete a record
 * @param {string} path - Database path (e.g., 'users/userId')
 * @returns {Promise<void>}
 */
export const deleteRecord = async (path) => {
  try {
    await db.ref(path).remove();
  } catch (error) {
    logger.error('Error deleting record', { path, error: error.message });
    throw error;
  }
};

/**
 * Upsert a record (create or update)
 * @param {string} path - Database path (e.g., 'users/userId')
 * @param {Object} data - Record data
 * @returns {Promise<Object>}
 */
export const upsertRecord = async (path, data) => {
  try {
    const existing = await getRecord(path);
    if (existing) {
      return await updateRecord(path, data);
    } else {
      await db.ref(path).set({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { ...data };
    }
  } catch (error) {
    logger.error('Error upserting record', { path, error: error.message });
    throw error;
  }
};

/**
 * Query records with filtering (Polymorphic: supports optimized object filters or legacy function filters)
 * @param {string} path - Database path
 * @param {Object|Function} filterArg - Filter criteria object { key: value } or filter function
 * @returns {Promise<Array>}
 */
export const queryRecords = async (path, filterArg) => {
  try {
    let query = db.ref(path);
    let records = [];

    if (typeof filterArg === 'object' && filterArg !== null) {
      // Optimized Server-Side Filtering (Hybrid)
      const filterKeys = Object.keys(filterArg);
      let remainingFilters = { ...filterArg };

      if (filterKeys.length > 0) {
        // Firebase Realtime DB only supports ONE orderByChild/equalTo at a time
        const firstKey = filterKeys[0];
        query = query.orderByChild(firstKey).equalTo(filterArg[firstKey]);
        delete remainingFilters[firstKey];
      }

      const snapshot = await query.once('value');
      const data = snapshot.val();
      if (!data) return [];

      records = Object.entries(data).map(([id, value]) => ({ id, ...value }));

      // Apply remaining filters in-memory
      if (Object.keys(remainingFilters).length > 0) {
        records = records.filter(record => 
          Object.entries(remainingFilters).every(([key, value]) => record[key] === value)
        );
      }
    } else if (typeof filterArg === 'function') {
      // Legacy In-Memory Filtering (O(N) - avoid in production at scale)
      const snapshot = await query.once('value');
      const data = snapshot.val();
      if (!data) return [];

      records = Object.entries(data).map(([id, value]) => ({ id, ...value }));
      records = records.filter(filterArg);
    } else {
      // Get all records
      const snapshot = await query.once('value');
      const data = snapshot.val();
      if (!data) return [];
      records = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    }

    return records;
  } catch (error) {
    logger.error('Error querying records', { path, error: error.message });
    throw error;
  }
};

/**
 * Batch write operations
 * @param {Array} operations - Array of { path, data, operation: 'set'|'update'|'remove' }
 * @returns {Promise<void>}
 */
export const batchWrite = async (operations) => {
  try {
    const updates = {};
    operations.forEach((op) => {
      if (op.operation === 'set') {
        updates[op.path] = op.data;
      } else if (op.operation === 'update') {
        updates[op.path] = op.data;
      } else if (op.operation === 'remove') {
        updates[op.path] = null;
      }
    });
    await db.ref().update(updates);
  } catch (error) {
    logger.error('Error in batch write', { error: error.message });
    throw error;
  }
};

/**
 * Listen to real-time updates
 * @param {string} path - Database path
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export const onRecordChange = (path, callback) => {
  const ref = db.ref(path);
  ref.on('value', (snapshot) => {
    callback(snapshot.val());
  });

  // Return unsubscribe function
  return () => ref.off('value');
};

// ============================================================================
// PROFILE LOOKUP HELPERS (handle both key formats from different seed scripts)
// ============================================================================

/**
 * Get student profile by userId - tries both direct key and user_id query
 */
export const getStudentProfileByUserId = async (userId) => {
  // Try direct key first (seed-firebase.js format)
  let profile = await getRecord(`student_profiles/${userId}`);
  if (profile) return profile;
  
  // Query by user_id (comprehensiveSeed.js format)
  const profiles = await queryRecords('student_profiles', (p) => p.user_id === userId);
  return profiles[0] || null;
};

/**
 * Get teacher profile by userId - tries both key formats
 */
export const getTeacherProfileByUserId = async (userId) => {
  let profile = await getRecord(`teacher_profiles/${userId}`);
  if (profile) return profile;
  
  const profiles = await queryRecords('teacher_profiles', (p) => p.user_id === userId);
  return profiles[0] || null;
};

/**
 * Get parent profile by userId - tries both key formats
 */
export const getParentProfileByUserId = async (userId) => {
  let profile = await getRecord(`parent_profiles/${userId}`);
  if (profile) return profile;
  
  const profiles = await queryRecords('parent_profiles', (p) => p.user_id === userId);
  return profiles[0] || null;
};

/**
 * Get driver profile by userId - tries both key formats
 */
export const getDriverProfileByUserId = async (userId) => {
  let profile = await getRecord(`driver_profiles/${userId}`);
  if (profile) return profile;
  
  const profiles = await queryRecords('driver_profiles', (p) => p.user_id === userId);
  return profiles[0] || null;
};
