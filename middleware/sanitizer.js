/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent XSS and injection attacks
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Remove potentially dangerous characters and HTML
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] }).trim();
};

/**
 * Recursively sanitize object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key to prevent prototype pollution
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey !== '__proto__' && sanitizedKey !== 'constructor' && sanitizedKey !== 'prototype') {
        sanitized[sanitizedKey] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Middleware to sanitize request body, query, and params
 */
export const sanitizeInput = (req, _res, next) => {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Sanitize specific fields in request body
 */
export const sanitizeFields = (fields = []) => {
  return (req, _res, next) => {
    try {
      if (req.body) {
        fields.forEach(field => {
          if (req.body[field]) {
            req.body[field] = sanitizeString(req.body[field]);
          }
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default {
  sanitizeInput,
  sanitizeFields,
  sanitizeString,
  sanitizeObject,
};
