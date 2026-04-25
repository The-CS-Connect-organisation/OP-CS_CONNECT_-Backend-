/**
 * Migration Script: Supabase to Firebase
 * 
 * This script migrates all data from Supabase to Firebase Realtime Database
 * 
 * Usage:
 *   node scripts/migrateSupabaseToFirebase.js
 * 
 * Prerequisites:
 *   1. Set up Firebase credentials in .env
 *   2. Ensure Supabase credentials are available
 *   3. Firebase database should be empty or ready for overwrite
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Firebase
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: 'key-id',
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: 'client-id',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const firebaseDb = admin.database();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const log = (message, data = '') => {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
};

const logError = (message, error) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
};

/**
 * Migrate a table from Supabase to Firebase
 */
const migrateTable = async (tableName, firebasePath) => {
  try {
    log(`Starting migration of ${tableName}...`);

    // Fetch all records from Supabase
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      logError(`Failed to fetch ${tableName}`, error);
      return { success: false, table: tableName, error: error.message };
    }

    if (!data || data.length === 0) {
      log(`No data found in ${tableName}, skipping...`);
      return { success: true, table: tableName, count: 0 };
    }

    // Convert array to object with id as key
    const firebaseData = {};
    data.forEach((record) => {
      const id = record.id;
      firebaseData[id] = record;
    });

    // Write to Firebase
    await firebaseDb.ref(firebasePath).set(firebaseData);

    log(`✓ Successfully migrated ${tableName}`, `(${data.length} records)`);
    return { success: true, table: tableName, count: data.length };
  } catch (error) {
    logError(`Migration failed for ${tableName}`, error);
    return { success: false, table: tableName, error: error.message };
  }
};

/**
 * Main migration function
 */
const runMigration = async () => {
  log('='.repeat(60));
  log('Starting Supabase to Firebase Migration');
  log('='.repeat(60));

  const tables = [
    { supabase: 'users', firebase: 'users' },
    { supabase: 'classrooms', firebase: 'classrooms' },
    { supabase: 'student_profiles', firebase: 'student_profiles' },
    { supabase: 'teacher_profiles', firebase: 'teacher_profiles' },
    { supabase: 'parent_profiles', firebase: 'parent_profiles' },
    { supabase: 'classroom_students', firebase: 'classroom_students' },
    { supabase: 'classroom_teachers', firebase: 'classroom_teachers' },
    { supabase: 'assignments', firebase: 'assignments' },
    { supabase: 'submissions', firebase: 'submissions' },
    { supabase: 'messages', firebase: 'messages' },
    { supabase: 'attendance', firebase: 'attendance' },
    { supabase: 'marks', firebase: 'marks' },
    { supabase: 'fees', firebase: 'fees' },
    { supabase: 'gamification_events', firebase: 'gamification_events' },
    { supabase: 'user_badges', firebase: 'user_badges' },
  ];

  const results = [];

  for (const table of tables) {
    const result = await migrateTable(table.supabase, table.firebase);
    results.push(result);
  }

  // Summary
  log('='.repeat(60));
  log('Migration Summary');
  log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  successful.forEach(r => {
    log(`✓ ${r.table}: ${r.count} records`);
  });

  if (failed.length > 0) {
    log('');
    log('Failed migrations:');
    failed.forEach(r => {
      logError(`✗ ${r.table}`, r.error);
    });
  }

  log('');
  log(`Total: ${successful.length}/${results.length} tables migrated successfully`);
  log('='.repeat(60));

  // Close connections
  await firebaseDb.goOffline();
  process.exit(failed.length > 0 ? 1 : 0);
};

// Run migration
runMigration().catch((error) => {
  logError('Migration script failed', error);
  process.exit(1);
});
