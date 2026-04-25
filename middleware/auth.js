import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';
import { getRecord } from '../utils/firebaseDb.js';

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export const requireAuth = async (req, _res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const decoded = verifyToken(token);
    const user = await getRecord(`users/${decoded.sub}`);

    if (!user || !user.is_active) {
      throw new ApiError(401, 'Invalid authentication token');
    }

    req.user = {
      id: decoded.sub,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, 'Invalid authentication token'));
  }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return next();

    const decoded = verifyToken(token);
    const user = await getRecord(`users/${decoded.sub}`);

    if (user && user.is_active) {
      req.user = { id: decoded.sub, role: user.role, email: user.email, name: user.name };
    }
  } catch {
    // invalid token — continue without user
  }
  next();
};

export const allowRoles = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden'));
  }
  return next();
};
