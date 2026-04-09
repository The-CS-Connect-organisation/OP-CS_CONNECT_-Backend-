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

  res.status(201).json({
    success: true,
    token,
    user: toSafeUser(user),
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

  res.json({
    success: true,
    token,
    user: toSafeUser(user),
  });
});

export const me = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    message: 'Auth API is healthy',
  });
});
