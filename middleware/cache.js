/**
 * Caching Middleware
 * Provides in-memory caching for frequently accessed data
 */

const cache = new Map();
const cacheTimestamps = new Map();

/**
 * Cache configuration
 */
const CACHE_DURATIONS = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Generate cache key from request
 */
const generateCacheKey = (req) => {
  const userId = req.user?.id || 'anonymous';
  const path = req.path;
  const query = JSON.stringify(req.query || {});
  return `${userId}:${path}:${query}`;
};

/**
 * Cache middleware for GET requests
 */
export const cacheMiddleware = (duration = CACHE_DURATIONS.MEDIUM) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = generateCacheKey(req);
    const cachedData = cache.get(cacheKey);
    const timestamp = cacheTimestamps.get(cacheKey);
    
    // Check if cache exists and is still valid
    if (cachedData && timestamp && Date.now() - timestamp < duration) {
      return res.json(cachedData);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to cache response
    res.json = function(data) {
      cache.set(cacheKey, data);
      cacheTimestamps.set(cacheKey, Date.now());
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Invalidate cache for a specific pattern
 */
export const invalidateCache = (pattern) => {
  const keysToDelete = [];
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => {
    cache.delete(key);
    cacheTimestamps.delete(key);
  });
  
  return keysToDelete.length;
};

/**
 * Clear all cache
 */
export const clearCache = () => {
  cache.clear();
  cacheTimestamps.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
};

/**
 * Middleware to invalidate cache on mutations
 */
export const invalidateCacheOnMutation = (pattern) => {
  return (req, res, next) => {
    // Invalidate cache after successful mutation
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      if (data && data.success !== false) {
        invalidateCache(pattern);
      }
      return originalJson(data);
    };
    
    next();
  };
};

export default {
  cacheMiddleware,
  invalidateCache,
  clearCache,
  getCacheStats,
  invalidateCacheOnMutation,
  CACHE_DURATIONS,
};
