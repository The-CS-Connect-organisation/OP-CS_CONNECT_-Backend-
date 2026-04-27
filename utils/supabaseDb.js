/**
 * Supabase database utility functions
 * Drop-in replacement for firebaseDb.js — same function signatures.
 */

import { supabase } from '../config/supabase.js';
import { logger } from './logger.js';

/**
 * Get a single record by path  (e.g. 'users/userId')
 * For Supabase we treat the first segment as the table and the second as the id.
 */
export const getRecord = async (path) => {
  try {
    const [table, id] = path.split('/');
    if (!id) {
      // path is just a table name — return first row (unusual, but keep compat)
      const { data, error } = await supabase.from(table).select('*').limit(1).single();
      if (error) return null;
      return data;
    }
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (error) { logger.error('getRecord error', { path, error: error.message }); return null; }
    return data;
  } catch (err) {
    logger.error('getRecord exception', { path, error: err.message });
    return null;
  }
};

/**
 * Get all records from a table (path = table name).
 */
export const getRecords = async (path) => {
  try {
    const table = path.split('/')[0];
    const { data, error } = await supabase.from(table).select('*');
    if (error) { logger.error('getRecords error', { path, error: error.message }); return []; }
    return data || [];
  } catch (err) {
    logger.error('getRecords exception', { path, error: err.message });
    return [];
  }
};

/**
 * Create a new record (push-style — generates id via Supabase default uuid).
 */
export const createRecord = async (path, data) => {
  try {
    const table = path.split('/')[0];
    const now = new Date().toISOString();
    const row = { ...data, created_at: data.created_at || now, updated_at: now };
    const { data: inserted, error } = await supabase.from(table).insert(row).select().single();
    if (error) { logger.error('createRecord error', { path, error: error.message }); throw new Error(error.message); }
    return inserted;
  } catch (err) {
    logger.error('createRecord exception', { path, error: err.message });
    throw err;
  }
};

/**
 * Upsert a record at path 'table/id'.
 * Used everywhere the old code did updateRecord(`table/${id}`, data).
 */
export const updateRecord = async (path, data) => {
  try {
    const parts = path.split('/');
    const table = parts[0];
    const id = parts[1];
    const now = new Date().toISOString();
    const row = { ...data, updated_at: now };
    if (id) row.id = id;

    const { data: upserted, error } = await supabase
      .from(table)
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) { logger.error('updateRecord error', { path, error: error.message }); throw new Error(error.message); }
    return upserted;
  } catch (err) {
    logger.error('updateRecord exception', { path, error: err.message });
    throw err;
  }
};

/**
 * Delete a record at path 'table/id'.
 */
export const deleteRecord = async (path) => {
  try {
    const [table, id] = path.split('/');
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { logger.error('deleteRecord error', { path, error: error.message }); throw new Error(error.message); }
  } catch (err) {
    logger.error('deleteRecord exception', { path, error: err.message });
    throw err;
  }
};

/**
 * Upsert (alias kept for compat).
 */
export const upsertRecord = updateRecord;

/**
 * Query records with a JS filter function.
 * Fetches all rows from the table then filters in-memory.
 * For nested paths like 'study_plans/userId' we filter by user_id.
 */
export const queryRecords = async (path, filterFn) => {
  try {
    const parts = path.split('/');
    const table = parts[0];
    let query = supabase.from(table).select('*');

    // If path has a second segment treat it as a user_id scope
    if (parts[1]) {
      query = query.eq('user_id', parts[1]);
    }

    const { data, error } = await query;
    if (error) { logger.error('queryRecords error', { path, error: error.message }); return []; }
    return (data || []).filter(filterFn);
  } catch (err) {
    logger.error('queryRecords exception', { path, error: err.message });
    return [];
  }
};

/**
 * Batch write — executes multiple upserts/deletes.
 */
export const batchWrite = async (operations) => {
  try {
    await Promise.all(
      operations.map((op) => {
        if (op.operation === 'remove') return deleteRecord(op.path);
        return updateRecord(op.path, op.data);
      })
    );
  } catch (err) {
    logger.error('batchWrite exception', { error: err.message });
    throw err;
  }
};
