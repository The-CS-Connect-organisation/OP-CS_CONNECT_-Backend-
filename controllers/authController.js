import pkg from 'bcryptjs';
const { hash, compare } = pkg;
import { getRecord, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';

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
      user.class = `${profile.grade}-${profile.section}`;
      user.grade = profile.grade;
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
