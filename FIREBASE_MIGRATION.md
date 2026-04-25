# Firebase Migration Guide

This document outlines the migration from Supabase to Firebase Realtime Database for the OP-CS-CONNECT backend.

## Overview

The backend has been configured to use Firebase Realtime Database (`op-cs-connect`) instead of Supabase. This migration provides:

- Real-time database capabilities
- Simplified authentication with Firebase Admin SDK
- Better integration with Firebase ecosystem
- Reduced operational complexity

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create or select your project: `op-cs-connect`
3. Enable Realtime Database:
   - Go to **Build** → **Realtime Database**
   - Click **Create Database**
   - Choose location (e.g., `us-central1`)
   - Start in **Test Mode** (for development)

### 2. Service Account Configuration

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Copy the JSON file contents
4. Extract these values for your `.env` file:
   - `FIREBASE_PROJECT_ID`: `project_id`
   - `FIREBASE_PRIVATE_KEY`: `private_key` (keep the `\n` characters)
   - `FIREBASE_CLIENT_EMAIL`: `client_email`
   - `FIREBASE_DATABASE_URL`: `https://op-cs-connect.firebaseio.com`

### 3. Environment Variables

Update your `.env` file:

```env
FIREBASE_PROJECT_ID=op-cs-connect
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@op-cs-connect.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://op-cs-connect.firebaseio.com
```

### 4. Install Dependencies

```bash
npm install
```

This will install `firebase-admin` and other required packages.

## Database Structure

Firebase Realtime Database uses a JSON tree structure. Here's the recommended structure for OP-CS-CONNECT:

```
op-cs-connect/
├── users/
│   ├── {userId}/
│   │   ├── id
│   │   ├── name
│   │   ├── email
│   │   ├── role (student|teacher|admin)
│   │   ├── is_active
│   │   ├── created_at
│   │   └── updated_at
├── classrooms/
│   ├── {classId}/
│   │   ├── id
│   │   ├── name
│   │   ├── teacher_id
│   │   ├── created_at
│   │   └── updated_at
├── student_profiles/
│   ├── {profileId}/
│   │   ├── user_id
│   │   ├── grade
│   │   ├── parent_name
│   │   ├── parent_phone
│   │   ├── created_at
│   │   └── updated_at
├── teacher_profiles/
│   ├── {profileId}/
│   │   ├── user_id
│   │   ├── subject
│   │   ├── phone
│   │   ├── created_at
│   │   └── updated_at
├── assignments/
│   ├── {assignmentId}/
│   │   ├── title
│   │   ├── class_id
│   │   ├── due_date
│   │   ├── created_at
│   │   └── updated_at
├── submissions/
│   ├── {submissionId}/
│   │   ├── assignment_id
│   │   ├── student_id
│   │   ├── submitted_at
│   │   ├── created_at
│   │   └── updated_at
├── messages/
│   ├── {messageId}/
│   │   ├── sender_id
│   │   ├── recipient_id
│   │   ├── content
│   │   ├── created_at
│   │   └── updated_at
└── error_logs/
    ├── {logId}/
    │   ├── path
    │   ├── method
    │   ├── status_code
    │   ├── message
    │   ├── created_at
    │   └── updated_at
```

## API Changes

### Utility Functions

The new Firebase utility module (`utils/firebaseDb.js`) provides these functions:

```javascript
import {
  getRecord,        // Get single record by path
  getRecords,       // Get multiple records with filtering
  createRecord,     // Create new record
  updateRecord,     // Update existing record
  deleteRecord,     // Delete record
  upsertRecord,     // Create or update
  queryRecords,     // Query with filter function
  batchWrite,       // Batch operations
  onRecordChange,   // Real-time listener
} from '../utils/firebaseDb.js';
```

### Example Usage

**Before (Supabase):**
```javascript
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();
```

**After (Firebase):**
```javascript
const user = await getRecord(`users/${userId}`);
```

**Before (Supabase):**
```javascript
const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'student');
```

**After (Firebase):**
```javascript
const users = await queryRecords('users', (user) => user.role === 'student');
```

## Migration Checklist

- [x] Install Firebase Admin SDK
- [x] Update environment configuration
- [x] Create Firebase configuration file
- [x] Update database connection logic
- [x] Create Firebase utility functions
- [x] Update authentication middleware
- [x] Update error handler middleware
- [ ] Migrate all controllers to use Firebase utilities
- [ ] Update all routes to use new database functions
- [ ] Test all endpoints
- [ ] Set up Firebase security rules
- [ ] Deploy to production

## Controllers to Update

The following controllers still need to be updated to use Firebase:

1. `controllers/authController.js` - User authentication
2. `controllers/schoolController.js` - School/classroom management
3. `controllers/aiController.js` - AI features
4. `controllers/chatController.js` - Chat functionality
5. `controllers/gamificationController.js` - Gamification features
6. `controllers/feesController.js` - Fees management

## Firebase Security Rules

For production, set up proper security rules in Firebase Console:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    },
    "classrooms": {
      ".read": "auth !== null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'teacher' || root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    ".read": false,
    ".write": false
  }
}
```

## Troubleshooting

### Connection Issues

If you see "Firebase connection failed":
1. Verify `FIREBASE_PROJECT_ID` matches your Firebase project
2. Check `FIREBASE_PRIVATE_KEY` is properly formatted with `\n` characters
3. Ensure the service account has Realtime Database permissions

### Authentication Errors

If authentication fails:
1. Verify the user exists in the `users` path
2. Check that `is_active` is set to `true`
3. Ensure JWT tokens are valid

### Performance Issues

For large datasets:
1. Use pagination with `limitToFirst` or `limitToLast`
2. Index frequently queried fields in Firebase Console
3. Consider denormalizing data for read-heavy operations

## Support

For more information:
- [Firebase Realtime Database Documentation](https://firebase.google.com/docs/database)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
