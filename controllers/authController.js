import pkg from 'bcryptjs';
const { hash, compare } = pkg;
import { supabase } from '../config/supabase.js';
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
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('grade, section, roll_number, attendance_percent, subjects, parent_name, parent_phone')
      .eq('user_id', user.id)
      .maybeSingle();
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
    const { data: enrollment } = await supabase
      .from('classroom_students')
      .select('classroom_id')
      .eq('student_id', user.id)
      .maybeSingle();
    if (enrollment) user.classroomId = enrollment.classroom_id;
  } else if (user.role === 'teacher') {
    const { data: profile } = await supabase
      .from('teacher_profiles')
      .select('subjects, phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile) {
      user.subjects = profile.subjects;
      user.phone = profile.phone;
    }
    // Get classrooms this teacher teaches
    const { data: classrooms } = await supabase
      .from('classroom_teachers')
      .select('classroom_id')
      .eq('teacher_id', user.id);
    user.classroomIds = (classrooms || []).map(c => c.classroom_id);
  } else if (user.role === 'parent') {
    const { data: profile } = await supabase
      .from('parent_profiles')
      .select('child_ids, phone')
      .eq('user_id', user.id)
      .maybeSingle();
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
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }

  const passwordHash = await hash(password, 12);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ name, email: email.toLowerCase().trim(), password_hash: passwordHash, role })
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);

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

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!user || !user.is_active) {
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
