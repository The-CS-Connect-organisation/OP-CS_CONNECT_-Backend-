import { Router } from 'express';
import { login, me, signup, requestPasswordReset, verifyResetOtp, resetPassword, deleteUser } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, signupSchema } from '../validators/authValidators.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRecord, queryRecords, updateRecord } from '../utils/firebaseDb.js';
import pkg from 'bcryptjs';
const { hash } = pkg;

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));
router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));

// Update profile
router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const userId = req.user.id;

  const updates = {
    ...(name !== undefined && { name }),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`users/${userId}`, updates);

  // Update role-specific profile if phone provided
  if (phone) {
    const role = req.user.role;
    if (role === 'student') {
      const { getStudentProfileByUserId } = await import('../utils/firebaseDb.js');
      const profile = await getStudentProfileByUserId(userId);
      if (profile) await updateRecord(`student_profiles/${profile.id}`, { phone, updated_at: new Date().toISOString() });
    } else if (role === 'teacher') {
      const { getTeacherProfileByUserId } = await import('../utils/firebaseDb.js');
      const profile = await getTeacherProfileByUserId(userId);
      if (profile) await updateRecord(`teacher_profiles/${profile.id}`, { phone, updated_at: new Date().toISOString() });
    }
  }

  const updatedUser = await getRecord(`users/${userId}`);
  res.json({ success: true, user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, is_active: updatedUser.is_active } });
}));
router.post('/signup', validateRequest(signupSchema), signup);
router.post('/login', validateRequest(loginSchema), login);

// Password Reset
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// Delete User (admin only)
router.delete('/users/:userId', requireAuth, allowRoles('admin'), deleteUser);

// One-time seed endpoint - creates missing demo users + bus + route + driver profile (admin only)
router.post('/seed-demo-users', requireAuth, allowRoles('admin'), asyncHandler(async (req, res) => {
  const demoUsers = [
    { name: 'Rajesh Kumar',  email: 'driver@schoolsync.edu',  role: 'driver',  password: 'driver123' },
    { name: 'Suresh Patel',  email: 'driver2@schoolsync.edu', role: 'driver',  password: 'driver123' },
    { name: 'Mohan Singh',   email: 'driver3@schoolsync.edu', role: 'driver',  password: 'driver123' },
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu',   role: 'admin',   password: 'admin123'  },
    { name: 'James Anderson',email: 'james@schoolsync.edu',   role: 'teacher', password: 'teacher123'},
    { name: 'Aarav Menon',   email: 'alex@schoolsync.edu',    role: 'student', password: 'student123'},
  ];

  const created = [];
  const skipped = [];
  const userIds = {};

  for (const u of demoUsers) {
    const existing = await queryRecords('users', (x) => x.email === u.email);
    if (existing.length > 0) {
      skipped.push(u.email);
      userIds[u.email] = existing[0].id;
      continue;
    }
    const passwordHash = await hash(u.password, 12);
    const userId = `${u.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await updateRecord(`users/${userId}`, {
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      is_active: true,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push(u.email);
    userIds[u.email] = userId;
  }

  // Create demo route centered on Chandanagar, Hyderabad
  const existingRoutes = await queryRecords('routes', (r) => r.name === 'Chandanagar Route A');
  let routeId;
  if (existingRoutes.length > 0) {
    routeId = existingRoutes[0].id;
  } else {
    routeId = `route-${Date.now()}`;
    await updateRecord(`routes/${routeId}`, {
      id: routeId,
      name: 'Chandanagar Route A',
      description: 'Demo route covering Chandanagar area, Hyderabad',
      status: 'active',
      start_time: '07:00',
      end_time: '09:00',
      total_distance: 8,
      estimated_duration: 45,
      stops: [
        { name: 'Chandanagar Bus Stop',    latitude: 17.4967, longitude: 78.3614, time: '07:00' },
        { name: 'Medicover Hospital Stop', latitude: 17.4983, longitude: 78.3146, time: '07:15' },
        { name: 'Lingampally Station',     latitude: 17.4950, longitude: 78.3200, time: '07:30' },
        { name: 'Miyapur X Roads',         latitude: 17.4940, longitude: 78.3550, time: '07:45' },
        { name: 'Cornerstone School Gate', latitude: 17.4960, longitude: 78.3700, time: '08:00' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push('route:Chandanagar Route A');
  }

  // Create demo bus assigned to the route
  const existingBuses = await queryRecords('buses', (b) => b.bus_number === 'CS-001');
  let busId;
  if (existingBuses.length > 0) {
    busId = existingBuses[0].id;
  } else {
    busId = `bus-${Date.now()}`;
    const driverId = userIds['driver@schoolsync.edu'];
    await updateRecord(`buses/${busId}`, {
      id: busId,
      bus_number: 'CS-001',
      license_plate: 'TS-09-EA-1234',
      capacity: 40,
      status: 'active',
      route_id: routeId,
      driver_id: driverId,
      current_location: {
        latitude: 17.4967,
        longitude: 78.3614,
        speed: 0,
        heading: 0,
        timestamp: new Date().toISOString(),
      },
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push('bus:CS-001');
  }

  // Create driver profile linking driver to bus
  const driverId = userIds['driver@schoolsync.edu'];
  if (driverId) {
    await updateRecord(`driver_profiles/${driverId}`, {
      user_id: driverId,
      bus_number: 'CS-001',
      license_plate: 'TS-09-EA-1234',
      phone: '+91-9876543210',
      route_id: routeId,
      bus_id: busId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push('driver_profile:driver@schoolsync.edu');
  }

  res.json({ success: true, created, skipped, routeId, busId });
}));

export default router;
