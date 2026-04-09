import pkg from 'jsonwebtoken';
import { env } from '../config/env.js';

const { sign, verify } = pkg;

export const signToken = (payload) =>
  sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
  });

export const verifyToken = (token) => verify(token, env.JWT_SECRET);
