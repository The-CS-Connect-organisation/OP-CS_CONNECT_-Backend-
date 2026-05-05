import pkg from 'bcryptjs';
const { hash, compare } = pkg;
import { getRecord, queryRecords, updateRecord, deleteRecord } from '../utils/firebaseDb.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';
import { createRecord } from '../utils/firebaseDb.js';
import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Provision user in GetStream so they can connect to chat
const provisionStreamUser = async (userId, name, role) => {
  if (!env.STREAM_API_KEY || !env.STREAM_API_SECRET) return;
  try {
    const sanitizedId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
    const serverClient = StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
    await serverClient.upsertUser({
      id: sanitizedId,
      name: name || 'User',
      role: role === 'admin' ? 'admin' : 'user',
    });
  } catch (err) {
    logger.warn('GetStream upsert failed (non-fatal)', { userId, message: err.message });
  }
};

const toSafeUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  isActive: row.is_active,
  createdAt: row.created_at,
});

// Fetch and attach profile data to the user object
const enrichUser = async (user) => {
  if (user.role === 'student') {
    const profile = await getRecord(`student_profiles/${user.id}`);
    if (profile) {
      // Auto-increment class at start of Indian academic year (April 1st)
      // Indian academic year: April 1 - March 31
      let classNum = parseInt(profile.class || profile.grade || '1');
      const lastIncrementDate = profile.lastClassIncrementDate ? new Date(profile.lastClassIncrementDate) : null;
      const currentDate = new Date();
      
      // Academic year starts on April 1st
      const currentYear = currentDate.getFullYear();
      const academicYearStart = new Date(currentYear, 3, 1); // April 1st of current year
      
      // If we're on or past April 1st and haven't incremented this academic year, increment the class
      if (currentDate >= academicYearStart && (!lastIncrementDate || lastIncrementDate < academicYearStart)) {
        classNum = Math.min(classNum + 1, 12); // Cap at class 12
        await updateRecord(`student_profiles/${user.id}`, {
          class: classNum.toString(),
          grade: classNum.toString(),
          lastClassIncrementDate: currentDate.toISOString(),
          updated_at: currentDate.toISOString(),
        });
      }
      
      user.class = `${classNum}-${profile.section || 'A'}`;
      user.grade = classNum.toString();
      user.section = profile.section;
      user.rollNo = profile.roll_number;
      user.attendancePercent = profile.attendance_percent;
      user.xp = 0;
      user.badges = [];
      user.subjects = profile.subjects;
      user.parentName = profile.parent_name;
      user.parentPhone = profile.parent_phone;
    }
    // Get classroom id
    const enrollments = await queryRecords('classroom_students', (e) => e.student_id === user.id);
    if (enrollments.length > 0) {
      user.classroomId = enrollments[0].classroom_id;
    }
  } else if (user.role === 'teacher') {
    const profile = await getRecord(`teacher_profiles/${user.id}`);
    if (profile) {
      user.subjects = profile.subjects;
      user.phone = profile.phone;
    }
    // Get classrooms this teacher teaches
    const classrooms = await queryRecords('classroom_teachers', (c) => c.teacher_id === user.id);
    user.classroomIds = classrooms.map(c => c.classroom_id);
  } else if (user.role === 'parent') {
    const profile = await getRecord(`parent_profiles/${user.id}`);
    if (profile) {
      user.childIds = profile.child_ids;
      user.phone = profile.phone;
    }
  } else if (user.role === 'driver') {
    const profile = await getRecord(`driver_profiles/${user.id}`);
    if (profile) {
      user.busNumber = profile.bus_number;
      user.licensePlate = profile.license_plate;
      user.phone = profile.phone;
      user.routeId = profile.route_id;
    }
  }
  return user;
};

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if email already exists
  const existingUsers = await queryRecords('users', (u) => u.email === email.toLowerCase().trim());

  if (existingUsers.length > 0) {
    throw new ApiError(409, 'Email already registered');
  }

  const passwordHash = await hash(password, 12);
  const userId = Date.now().toString();
  
  const user = {
    id: userId,
    name,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    role,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`users/${userId}`, user);

  // Create role-specific profile
  if (role === 'student') {
    const studentProfile = {
      id: userId,
      user_id: userId,
      grade: '',
      section: '',
      roll_number: '',
      subjects: [],
      parent_name: '',
      parent_phone: '',
      attendance_percent: 100,
      xp: 0,
      badges: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateRecord(`student_profiles/${userId}`, studentProfile);
  } else if (role === 'teacher') {
    const teacherProfile = {
      id: userId,
      user_id: userId,
      subjects: [],
      phone: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateRecord(`teacher_profiles/${userId}`, teacherProfile);
  } else if (role === 'parent') {
    const parentProfile = {
      id: userId,
      user_id: userId,
      child_ids: [],
      phone: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateRecord(`parent_profiles/${userId}`, parentProfile);
  } else if (role === 'driver') {
    const driverProfile = {
      id: userId,
      user_id: userId,
      bus_number: '',
      license_plate: '',
      phone: '',
      route_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateRecord(`driver_profiles/${userId}`, driverProfile);
  } else if (role === 'librarian') {
    const librarianProfile = {
      id: userId,
      user_id: userId,
      library_section: '',
      phone: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateRecord(`librarian_profiles/${userId}`, librarianProfile);
  }

  const token = signToken({ sub: user.id, role: user.role });

  const safeUser = toSafeUser(user);
  await enrichUser(safeUser);

  res.status(201).json({
    success: true,
    token,
    user: safeUser,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const users = await queryRecords('users', (u) => u.email === email.toLowerCase().trim());

  if (users.length === 0) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const user = users[0];

  if (!user.is_active) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = signToken({ sub: user.id, role: user.role });

  const safeUser = toSafeUser(user);
  await enrichUser(safeUser);

  // Provision in GetStream on every login (ensures new/existing users can chat)
  provisionStreamUser(user.id, user.name, user.role).catch(() => {});

  res.json({
    success: true,
    token,
    user: safeUser,
  });
});

export const me = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    message: 'Auth API is healthy',
  });
});

// ============================================================================
// PASSWORD RESET
// ============================================================================

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required');

  const users = await queryRecords('users', (u) => u.email === email.toLowerCase().trim());

  // Always return success to prevent email enumeration
  if (users.length === 0) {
    return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
  }

  const user = users[0];

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  await updateRecord(`password_resets/${user.id}`, {
    user_id: user.id,
    email: user.email,
    otp,
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  });

  // In production this sends an email. OTP is only returned in non-production for testing.
  const responsePayload = {
    success: true,
    message: 'If that email exists, a reset code has been sent.',
  };
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.demo_otp = otp;
    responsePayload.user_id = user.id;
  }
  res.json(responsePayload);
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) throw new ApiError(400, 'userId and otp are required');

  const resetRecord = await getRecord(`password_resets/${userId}`);

  if (!resetRecord) throw new ApiError(400, 'Invalid or expired reset code');
  if (resetRecord.used) throw new ApiError(400, 'Reset code already used');
  if (new Date(resetRecord.expires_at) < new Date()) throw new ApiError(400, 'Reset code has expired');
  if (resetRecord.otp !== otp) throw new ApiError(400, 'Invalid reset code');

  // Issue a short-lived reset token
  const resetToken = signToken({ sub: userId, purpose: 'password_reset' }, '15m');

  res.json({ success: true, resetToken });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) throw new ApiError(400, 'resetToken and newPassword are required');
  if (newPassword.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  // Verify token
  let decoded;
  try {
    const { verifyToken } = await import('../utils/jwt.js');
    decoded = verifyToken(resetToken);
  } catch {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  if (decoded.purpose !== 'password_reset') throw new ApiError(400, 'Invalid reset token');

  const userId = decoded.sub;
  const passwordHash = await hash(newPassword, 12);

  await updateRecord(`users/${userId}`, {
    password_hash: passwordHash,
    updated_at: new Date().toISOString(),
  });

  // Mark reset record as used
  await updateRecord(`password_resets/${userId}`, { used: true });

  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
});

// ============================================================================
// DELETE USER
// ============================================================================

export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  // Get the user to find their role
  const user = await getRecord(`users/${userId}`);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Delete user record
  await deleteRecord(`users/${userId}`);

  // Delete role-specific profile based on role
  if (user.role === 'student') {
    await deleteRecord(`student_profiles/${userId}`);
  } else if (user.role === 'teacher') {
    await deleteRecord(`teacher_profiles/${userId}`);
  } else if (user.role === 'parent') {
    await deleteRecord(`parent_profiles/${userId}`);
  } else if (user.role === 'driver') {
    await deleteRecord(`driver_profiles/${userId}`);
  } else if (user.role === 'librarian') {
    await deleteRecord(`librarian_profiles/${userId}`);
  }

  res.json({ 
    success: true, 
    message: `User ${user.name} and associated profile deleted successfully` 
  });
});
