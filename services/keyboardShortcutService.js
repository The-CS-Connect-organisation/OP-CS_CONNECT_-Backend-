/**
 * Keyboard Shortcuts Service
 * Tracks and manages keyboard shortcuts for productivity features
 */

import { getRecords, queryRecords, updateRecord, createRecord } from '../utils/firebaseDb.js';
import { logger } from '../utils/logger.js';

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS = {
  // Attendance
  'attendance:mark_present': { keys: ['a', 'p'], description: 'Mark attendance as present' },
  'attendance:mark_absent': { keys: ['a', 'a'], description: 'Mark attendance as absent' },
  'attendance:mark_late': { keys: ['a', 'l'], description: 'Mark attendance as late' },
  'attendance:next_student': { keys: ['ArrowDown'], description: 'Move to next student' },
  'attendance:prev_student': { keys: ['ArrowUp'], description: 'Move to previous student' },
  'attendance:save': { keys: ['ctrl', 's'], description: 'Save attendance' },
  
  // Grading
  'grading:next_submission': { keys: ['ArrowRight'], description: 'Next submission' },
  'grading:prev_submission': { keys: ['ArrowLeft'], description: 'Previous submission' },
  'grading:save': { keys: ['ctrl', 's'], description: 'Save grade' },
  'grading:add_feedback': { keys: ['ctrl', 'f'], description: 'Add feedback' },
  'grading:apply_template': { keys: ['ctrl', 't'], description: 'Apply template' },
  
  // Messaging
  'messaging:send': { keys: ['ctrl', 'Enter'], description: 'Send message' },
  'messaging:close': { keys: ['Escape'], description: 'Close message composer' },
  'messaging:new': { keys: ['ctrl', 'm'], description: 'New message' },
  
  // General
  'general:search': { keys: ['ctrl', 'f'], description: 'Search' },
  'general:help': { keys: ['?'], description: 'Show help' },
  'general:dashboard': { keys: ['ctrl', 'h'], description: 'Go to dashboard' },
};

/**
 * Get all available shortcuts
 */
export const getAvailableShortcuts = () => {
  return {
    success: true,
    shortcuts: DEFAULT_SHORTCUTS,
    count: Object.keys(DEFAULT_SHORTCUTS).length,
  };
};

/**
 * Get user's custom shortcuts
 */
export const getUserShortcuts = async (userId) => {
  try {
    const shortcuts = await queryRecords('user_shortcuts', (s) => s.user_id === userId);
    
    if (shortcuts.length === 0) {
      // Return default shortcuts for new user
      return {
        success: true,
        shortcuts: DEFAULT_SHORTCUTS,
        isDefault: true,
      };
    }
    
    // Merge custom shortcuts with defaults
    const customShortcuts = {};
    shortcuts.forEach(s => {
      customShortcuts[s.action] = {
        keys: s.keys,
        description: s.description,
        custom: true,
      };
    });
    
    const merged = {
      ...DEFAULT_SHORTCUTS,
      ...customShortcuts,
    };
    
    return {
      success: true,
      shortcuts: merged,
      isDefault: false,
    };
  } catch (error) {
    logger.error('Error getting user shortcuts', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Update user's shortcut
 */
export const updateUserShortcut = async (userId, action, keys) => {
  try {
    // Validate action exists
    if (!DEFAULT_SHORTCUTS[action] && !await queryRecords('user_shortcuts', (s) => s.action === action)) {
      return { success: false, error: 'Invalid action' };
    }
    
    // Validate keys format
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: false, error: 'Keys must be a non-empty array' };
    }
    
    const shortcutId = `${userId}_${action}`;
    const shortcut = {
      id: shortcutId,
      user_id: userId,
      action,
      keys,
      description: DEFAULT_SHORTCUTS[action]?.description || '',
      custom: true,
      updated_at: new Date().toISOString(),
    };
    
    await updateRecord(`user_shortcuts/${shortcutId}`, shortcut);
    
    logger.info(`Shortcut updated for user ${userId}: ${action} -> ${keys.join('+')}`);
    
    return {
      success: true,
      shortcut,
    };
  } catch (error) {
    logger.error('Error updating user shortcut', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Reset user's shortcuts to default
 */
export const resetUserShortcuts = async (userId) => {
  try {
    const shortcuts = await queryRecords('user_shortcuts', (s) => s.user_id === userId);
    
    // Delete all custom shortcuts
    await Promise.all(
      shortcuts.map(s => updateRecord(`user_shortcuts/${s.id}`, null))
    );
    
    logger.info(`Shortcuts reset to default for user ${userId}`);
    
    return {
      success: true,
      message: 'Shortcuts reset to default',
    };
  } catch (error) {
    logger.error('Error resetting user shortcuts', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Track shortcut usage
 */
export const trackShortcutUsage = async (userId, action) => {
  try {
    const trackingId = `${userId}_${action}_${Date.now()}`;
    
    const usage = {
      id: trackingId,
      user_id: userId,
      action,
      used_at: new Date().toISOString(),
    };
    
    await createRecord(`shortcut_usage/${trackingId}`, usage);
    
    return { success: true };
  } catch (error) {
    logger.error('Error tracking shortcut usage', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get shortcut usage statistics
 */
export const getShortcutUsageStats = async (userId, days = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const usageRecords = await queryRecords('shortcut_usage', (u) => 
      u.user_id === userId && new Date(u.used_at) >= cutoffDate
    );
    
    // Group by action
    const stats = {};
    usageRecords.forEach(record => {
      if (!stats[record.action]) {
        stats[record.action] = 0;
      }
      stats[record.action]++;
    });
    
    // Sort by usage count
    const sorted = Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .map(([action, count]) => ({
        action,
        count,
        description: DEFAULT_SHORTCUTS[action]?.description || 'Custom shortcut',
      }));
    
    return {
      success: true,
      period: `Last ${days} days`,
      totalUsage: usageRecords.length,
      stats: sorted,
      mostUsed: sorted[0] || null,
    };
  } catch (error) {
    logger.error('Error getting shortcut usage stats', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get shortcut recommendations based on usage
 */
export const getShortcutRecommendations = async (userId) => {
  try {
    const usageStats = await getShortcutUsageStats(userId, 30);
    
    if (!usageStats.success) {
      return { success: false, error: usageStats.error };
    }
    
    const recommendations = [];
    const usedActions = new Set(usageStats.stats.map(s => s.action));
    
    // Find unused shortcuts that might be helpful
    Object.entries(DEFAULT_SHORTCUTS).forEach(([action, shortcut]) => {
      if (!usedActions.has(action)) {
        recommendations.push({
          action,
          keys: shortcut.keys,
          description: shortcut.description,
          reason: 'You haven\'t used this shortcut yet',
        });
      }
    });
    
    // Prioritize recommendations
    const prioritized = recommendations.slice(0, 5);
    
    return {
      success: true,
      recommendations: prioritized,
      message: `Try these ${prioritized.length} shortcuts to improve productivity`,
    };
  } catch (error) {
    logger.error('Error getting shortcut recommendations', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Validate shortcut key combination
 */
export const validateShortcutKeys = (keys) => {
  if (!Array.isArray(keys) || keys.length === 0) {
    return { valid: false, error: 'Keys must be a non-empty array' };
  }
  
  const validKeys = [
    'ctrl', 'alt', 'shift', 'meta',
    'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown',
    ...Array.from('abcdefghijklmnopqrstuvwxyz0123456789'),
  ];
  
  const allValid = keys.every(key => validKeys.includes(key));
  
  if (!allValid) {
    return { valid: false, error: 'Invalid key in combination' };
  }
  
  // Check for valid combinations
  const modifiers = keys.filter(k => ['ctrl', 'alt', 'shift', 'meta'].includes(k));
  const mainKey = keys.find(k => !['ctrl', 'alt', 'shift', 'meta'].includes(k));
  
  if (!mainKey) {
    return { valid: false, error: 'Must have at least one main key' };
  }
  
  if (modifiers.length > 3) {
    return { valid: false, error: 'Too many modifiers' };
  }
  
  return { valid: true };
};

export default {
  DEFAULT_SHORTCUTS,
  getAvailableShortcuts,
  getUserShortcuts,
  updateUserShortcut,
  resetUserShortcuts,
  trackShortcutUsage,
  getShortcutUsageStats,
  getShortcutRecommendations,
  validateShortcutKeys,
};
