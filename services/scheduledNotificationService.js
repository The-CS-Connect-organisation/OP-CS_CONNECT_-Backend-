/**
 * Scheduled Notification Service
 * Handles scheduling and execution of notifications
 */

import { getRecords, queryRecords, updateRecord, getRecord } from '../utils/firebaseDb.js';
import { emitToUser, emitToClass } from '../utils/socket.js';
import { logger } from '../utils/logger.js';

// Store for scheduled jobs
const scheduledJobs = new Map();

/**
 * Schedule a notification for later delivery
 */
export const scheduleNotification = async (notification, delayMs) => {
  try {
    const jobId = `job_${notification.id}`;
    
    // Clear existing job if any
    if (scheduledJobs.has(jobId)) {
      clearTimeout(scheduledJobs.get(jobId));
    }
    
    // Schedule the notification
    const timeoutId = setTimeout(async () => {
      await executeScheduledNotification(notification);
      scheduledJobs.delete(jobId);
    }, delayMs);
    
    scheduledJobs.set(jobId, timeoutId);
    
    logger.info(`Notification ${notification.id} scheduled for ${new Date(Date.now() + delayMs).toISOString()}`);
    
    return { success: true, jobId, scheduledFor: new Date(Date.now() + delayMs) };
  } catch (error) {
    logger.error('Error scheduling notification', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Execute a scheduled notification
 */
export const executeScheduledNotification = async (notification) => {
  try {
    // Update notification as sent
    await updateRecord(`notifications/${notification.id}`, {
      sent_at: new Date().toISOString(),
    });
    
    // Determine target users
    let targetUserIds = notification.target_users || [];
    if (targetUserIds.length === 0 && notification.class_id) {
      const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === notification.class_id);
      targetUserIds = enrollments.map(e => e.student_id);
    }
    
    // Emit to each target user
    targetUserIds.forEach(userId => {
      emitToUser(userId, 'notification:new', notification);
    });
    
    logger.info(`Notification ${notification.id} executed and sent to ${targetUserIds.length} users`);
    
    return { success: true, sentTo: targetUserIds.length };
  } catch (error) {
    logger.error('Error executing scheduled notification', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Schedule recurring notifications
 */
export const scheduleRecurringNotification = async (notificationTemplate, interval, maxOccurrences = null) => {
  try {
    const recurringJobId = `recurring_${Date.now()}`;
    let occurrences = 0;
    
    const intervalId = setInterval(async () => {
      if (maxOccurrences && occurrences >= maxOccurrences) {
        clearInterval(intervalId);
        scheduledJobs.delete(recurringJobId);
        return;
      }
      
      const notification = {
        ...notificationTemplate,
        id: `${notificationTemplate.id}_${occurrences}`,
        created_at: new Date().toISOString(),
      };
      
      await executeScheduledNotification(notification);
      occurrences++;
    }, interval);
    
    scheduledJobs.set(recurringJobId, intervalId);
    
    logger.info(`Recurring notification scheduled with interval ${interval}ms`);
    
    return { success: true, jobId: recurringJobId };
  } catch (error) {
    logger.error('Error scheduling recurring notification', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Cancel a scheduled notification
 */
export const cancelScheduledNotification = (jobId) => {
  try {
    if (scheduledJobs.has(jobId)) {
      clearTimeout(scheduledJobs.get(jobId));
      scheduledJobs.delete(jobId);
      logger.info(`Scheduled notification ${jobId} cancelled`);
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  } catch (error) {
    logger.error('Error cancelling scheduled notification', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get all scheduled jobs
 */
export const getScheduledJobs = () => {
  return {
    count: scheduledJobs.size,
    jobs: Array.from(scheduledJobs.keys()),
  };
};

/**
 * Process scheduled notifications from database
 * Call this periodically to check for notifications that should be sent
 */
export const processScheduledNotifications = async () => {
  try {
    const now = new Date().toISOString();
    
    // Get all scheduled notifications that should be sent now
    const notifications = await queryRecords('notifications', (n) => 
      n.scheduled_at && n.scheduled_at <= now && !n.sent_at
    );
    
    if (notifications.length === 0) {
      return { processed: 0 };
    }
    
    // Execute each notification
    const results = await Promise.all(
      notifications.map(notification => executeScheduledNotification(notification))
    );
    
    logger.info(`Processed ${notifications.length} scheduled notifications`);
    
    return { processed: notifications.length, results };
  } catch (error) {
    logger.error('Error processing scheduled notifications', { error: error.message });
    return { processed: 0, error: error.message };
  }
};

/**
 * Schedule a notification with cron-like pattern
 * Supports: daily, weekly, monthly patterns
 */
export const scheduleNotificationWithPattern = async (notification, pattern) => {
  try {
    const now = new Date();
    let nextExecutionTime;
    
    switch (pattern.type) {
      case 'daily':
        nextExecutionTime = new Date(now);
        nextExecutionTime.setDate(nextExecutionTime.getDate() + 1);
        nextExecutionTime.setHours(pattern.hour || 9, pattern.minute || 0, 0, 0);
        break;
        
      case 'weekly':
        nextExecutionTime = new Date(now);
        const daysUntilTarget = (pattern.dayOfWeek - nextExecutionTime.getDay() + 7) % 7;
        nextExecutionTime.setDate(nextExecutionTime.getDate() + (daysUntilTarget || 7));
        nextExecutionTime.setHours(pattern.hour || 9, pattern.minute || 0, 0, 0);
        break;
        
      case 'monthly':
        nextExecutionTime = new Date(now);
        nextExecutionTime.setMonth(nextExecutionTime.getMonth() + 1);
        nextExecutionTime.setDate(pattern.dayOfMonth || 1);
        nextExecutionTime.setHours(pattern.hour || 9, pattern.minute || 0, 0, 0);
        break;
        
      default:
        throw new Error('Invalid pattern type');
    }
    
    const delayMs = nextExecutionTime.getTime() - now.getTime();
    
    return scheduleNotification(notification, delayMs);
  } catch (error) {
    logger.error('Error scheduling notification with pattern', { error: error.message });
    return { success: false, error: error.message };
  }
};

export default {
  scheduleNotification,
  executeScheduledNotification,
  scheduleRecurringNotification,
  cancelScheduledNotification,
  getScheduledJobs,
  processScheduledNotifications,
  scheduleNotificationWithPattern,
};
