import pkg from 'jsonwebtoken';
import { env } from '../config/env.js';

const { sign, verify } = pkg;

/**
 * Sign a JWT.
 * @param {object} payload
 * @param {string} [expiresIn='7d'] - e.g. '7d', '15m', '1h'
 */
export const signToken = (payload, expiresIn = '7d') =>
  sign(payload, env.JWT_SECRET, { expiresIn });

export const verifyToken = (token) => verify(token, env.JWT_SECRET);
