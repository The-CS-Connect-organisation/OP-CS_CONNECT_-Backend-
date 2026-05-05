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
 * Query records with filtering
 * @param {string} path - Database path
 * @param {Function} filterFn - Filter function
 * @returns {Promise<Array>}
 */
export const queryRecords = async (path, filterFn) => {
  try {
    const snapshot = await db.ref(path).once('value');
    const data = snapshot.val();

    if (!data) return [];

    const records = Object.entries(data).map(([id, value]) => ({
      id,
      ...value,
    }));

    return records.filter(filterFn);
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
