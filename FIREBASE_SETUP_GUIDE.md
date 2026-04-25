# Firebase Setup & Migration Guide

## Quick Start

### 1. Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `op-cs-connect`
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Copy the JSON file

### 2. Extract Credentials

From the JSON file, get these values:

```
FIREBASE_PROJECT_ID = project_id
FIREBASE_PRIVATE_KEY = private_key (keep \n characters)
FIREBASE_CLIENT_EMAIL = client_email
FIREBASE_DATABASE_URL = https://op-cs-connect.firebaseio.com
```

### 3. Update .env File

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-secret-key-here

FIREBASE_PROJECT_ID=op-cs-connect
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@op-cs-connect.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://op-cs-connect.firebaseio.com

CORS_ORIGIN=https://the-cs-connect-organisation.github.io

CEREBRAS_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
STREAM_API_KEY=n9v8bfwy45pn
STREAM_API_SECRET=
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Migrate Data from Supabase

If you have existing data in Supabase, run the migration script:

```bash
# First, set up Supabase credentials in .env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-key

# Then run migration
node scripts/migrateSupabaseToFirebase.js
```

### 6. Start the Server

```bash
npm start
```

The server will:
1. Connect to Firebase
2. Bootstrap default users (development only)
3. Start listening on port 5000

## Database Structure

Firebase Realtime Database uses JSON tree structure:

```
op-cs-connect/
├── users/
│   ├── {userId}/
│   │   ├── id
│   │   ├── name
│   │   ├── email
│   │   ├── role (student|teacher|admin|parent)
│   │   ├── is_active
│   │   ├── password_hash
│   │   ├── created_at
│   │   └── updated_at
├── classrooms/
├── student_profiles/
├── teacher_profiles/
├── parent_profiles/
├── classroom_students/
├── classroom_teachers/
├── assignments/
├── submissions/
├── messages/
├── attendance_records/
├── marks/
├── fees/
├── announcements/
├── timetables/
├── ai_interactions/
├── gamification_events/
├── user_badges/
└── error_logs/
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### School Management
- `GET /api/school/students` - List students
- `GET /api/school/teachers` - List teachers
- `POST /api/school/classrooms` - Create classroom
- `POST /api/school/assignments` - Create assignment
- `POST /api/school/attendance` - Mark attendance

### Gamification
- `POST /api/gamification/xp` - Award XP
- `GET /api/gamification/stats/:studentId` - Get student stats
- `GET /api/gamification/leaderboard/:classId` - Get leaderboard

### AI Features
- `POST /api/ai/chat` - Chat with AI
- `GET /api/ai/history` - Get chat history

### Fees
- `GET /api/fees` - List fees
- `POST /api/fees` - Create fee
- `PATCH /api/fees/:feeId` - Update fee

## Firebase Security Rules

Set these rules in Firebase Console → Realtime Database → Rules:

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
    "student_profiles": {
      ".read": "auth !== null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "assignments": {
      ".read": "auth !== null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'teacher' || root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "submissions": {
      ".read": "auth !== null",
      ".write": "auth !== null"
    },
    "messages": {
      ".read": "auth !== null",
      ".write": "auth !== null"
    },
    "fees": {
      ".read": "auth !== null",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    ".read": false,
    ".write": false
  }
}
```

## Troubleshooting

### Connection Failed
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project
- Check `FIREBASE_PRIVATE_KEY` has proper `\n` characters
- Ensure service account has Realtime Database permissions

### Authentication Errors
- Verify user exists in `users` path
- Check `is_active` is set to `true`
- Ensure JWT tokens are valid

### Data Not Appearing
- Check Firebase security rules allow read/write
- Verify data structure matches expected paths
- Check browser console for CORS errors

## Development vs Production

### Development
- Default users are auto-created
- Firebase runs in test mode (no security rules)
- Logs are verbose

### Production
- No default users created
- Firebase security rules enforced
- Logs are minimal
- CORS restricted to deployed frontend

## Backend URL

The backend is deployed at:
```
https://op-cs-connect-backend-vym7.onrender.com
```

Update your frontend `.env` to point to this URL:
```
VITE_API_URL=https://op-cs-connect-backend-vym7.onrender.com
```

## Support

For issues:
1. Check Firebase Console for errors
2. Review server logs: `npm start`
3. Verify environment variables are set correctly
4. Check Firebase security rules allow your operations
