/**
 * Notification Fallback Service
 * Provides email and push notification fallback for users without active WebSocket connections.
 * Uses Firebase Cloud Messaging for mobile push and nodemailer for email.
 */

import { getRecords, queryRecords, updateRecord } from '../utils/firebaseDb.js';
import { logger } from '../utils/logger.js';
import { isUserOnline } from './socket.js';

// FCM messaging instance (lazy initialization)
let messagingInstance = null;

const getMessaging = () => {
  if (messagingInstance) return messagingInstance;
  try {
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      logger.warn('Firebase Admin not initialized, skipping FCM');
      return null;
    }
    messagingInstance = admin.messaging();
    return messagingInstance;
  } catch (error) {
    logger.warn('FCM unavailable', { error: error.message });
    return null;
  }
};

/**
 * Send FCM push notification to a specific user
 */
export const sendFCMPush = async (userId, title, body, data = {}) => {
  try {
    const messaging = getMessaging();
    if (!messaging) return { success: false, reason: 'fcm_unavailable' };

    // Look up the user's FCM token from their profile
    const userRecord = await queryRecords('users', (u) => u.id === userId);
    const user = userRecord[0];
    if (!user) return { success: false, reason: 'user_not_found' };

    const fcmToken = user.fcm_token || user.notification_prefs?.fcm_token;
    if (!fcmToken) return { success: false, reason: 'no_fcm_token' };

    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        userId,
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'school_notifications',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    logger.info('FCM push sent', { userId, messageId: response });
    return { success: true, messageId: response };
  } catch (error) {
    logger.error('FCM push failed', { error: error.message, userId });
    // If the token is invalid, clear it from the user profile
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      try {
        const users = await queryRecords('users', (u) => u.id === userId);
        if (users.length > 0) {
          await updateRecord(`users/${userId}`, { fcm_token: null });
          logger.info('Cleared invalid FCM token for user', { userId });
        }
      } catch (cleanupError) {
        logger.warn('Failed to clear invalid FCM token', { error: cleanupError.message });
      }
    }
    return { success: false, reason: error.message };
  }
};

/**
 * Send email notification as a fallback
 */
export const sendEmailNotification = async (userId, toEmail, subject, body) => {
  try {
    // Check if nodemailer is configured
    const nodemailer = require('nodemailer');
    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
      logger.warn('SMTP credentials not configured, skipping email');
      return { success: false, reason: 'smtp_unconfigured' };
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"SchoolSync" <${SMTP_USER}>`,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #111111, #1a1a2e); padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">📚 SchoolSync</h1>
            <p style="color: #a8a8b3; margin: 4px 0 0;">Notification Alert</p>
          </div>
          <div style="padding: 24px; background: #ffffff; border-left: 4px solid #111111;">
            <h2 style="color: #111111; margin-top: 0;">${subject}</h2>
            <p style="color: #4a4a4a; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="padding: 16px; background: #f8f8f8; text-align: center;">
            <p style="margin: 0; color: #999; font-size: 12px;">SchoolSync Notification System • Sent ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('Email notification sent', { userId, to: toEmail, messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Email notification failed', { error: error.message, userId, toEmail });
    return { success: false, reason: error.message };
  }
};

/**
 * Check if a user is reachable via WebSocket
 * If not, fall back to FCM push, then email
 */
export const notifyWithFallback = async (userId, title, body, data = {}, type = 'notification') => {
  const result = {
    websocket: false,
    fcm: null,
    email: null,
    finalStatus: 'pending',
  };

  // Step 1: Check if user is connected via WebSocket
  if (isUserOnline(userId)) {
    result.websocket = true;
    result.finalStatus = 'delivered:websocket';
    logger.info('Notification delivered via WebSocket', { userId });
    return result;
  }

  logger.info('User not connected via WebSocket, trying fallbacks', { userId });

  // Step 2: Try FCM push notification
  const userRecord = await queryRecords('users', (u) => u.id === userId);
  const user = userRecord[0];

  if (user && (user.fcm_token || (user.notification_prefs && user.notification_prefs.fcm_token))) {
    result.fcm = await sendFCMPush(userId, title, body, data);
    if (result.fcm.success) {
      result.finalStatus = 'delivered:fcm';
      return result;
    }
  }

  // Step 3: Try email as final fallback
  if (user && user.email) {
    const notificationPref = user.notification_prefs || {};
    // Only send email if user hasn't opted out of email notifications
    if (notificationPref.email_notifications !== false) {
      result.email = await sendEmailNotification(userId, user.email, title, body);
      if (result.email.success) {
        result.finalStatus = 'delivered:email';
        return result;
      }
    }
  }

  result.finalStatus = 'failed';
  logger.warn('All notification delivery methods failed', { userId, fcm: result.fcm, email: result.email });
  return result;
};

/**
 * Send notifications to multiple users with fallbacks
 * Used by bulk notification features
 */
export const notifyMultipleWithFallback = async (userIds, title, body, data = {}) => {
  const results = [];

  // Send up to 50 notifications concurrently
  const batches = [];
  for (let i = 0; i < userIds.length; i += 50) {
    batches.push(userIds.slice(i, i + 50));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(userId =>
      notifyWithFallback(userId, title, body, data)
        .then(result => ({ userId, ...result }))
        .catch(error => ({
          userId,
          error: error.message,
          finalStatus: 'error',
        }))
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    // Small delay between batches to avoid overwhelming services
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Summary
  const summary = {
    total: results.length,
    websocket: results.filter(r => r.websocket).length,
    fcm: results.filter(r => r.fcm?.success).length,
    email: results.filter(r => r.email?.success).length,
    failed: results.filter(r => r.finalStatus === 'failed' || r.error).length,
  };

  return { results, summary };
};

/**
 * Store notification in database with tracking
 */
export const storeNotification = async ({ userId, message, type = 'info', meta = {}, senderId = null }) => {
  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const notification = {
    id: notificationId,
    user_id: userId,
    message,
    type,
    meta,
    read: false,
    delivery_method: null,
    delivered_at: null,
    created_by: senderId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const db = require('../utils/firebaseDb.js');
  await db.updateRecord(`notifications/${notificationId}`, notification);

  return notificationId;
};

/**
 * Send notification with database storage + fallback delivery
 */
export const sendFullNotification = async ({ userId, message, type = 'info', meta = {}, senderId = null, title = 'SchoolSync' }) => {
  // Store in database
  const notificationId = await storeNotification({ userId, message, type, meta, senderId });

  // Try real-time via Socket.IO first
  const { emitToUser } = await import('./socket.js');
  emitToUser(userId, 'notification:new', {
    id: notificationId,
    user_id: userId,
    message,
    type,
    meta,
    read: false,
    created_at: new Date().toISOString(),
  });

  // Fallback delivery for offline users
  const delivery = await notifyWithFallback(userId, title, message, { notificationId, type, ...meta });

  // Update notification record with delivery info
  await updateRecord(`notifications/${notificationId}`, {
    delivery_method: delivery.finalStatus,
    delivered_at: delivery.finalStatus !== 'failed' ? new Date().toISOString() : null,
  });

  return { notificationId, delivery };
};

export default {
  sendFCMPush,
  sendEmailNotification,
  notifyWithFallback,
  notifyMultipleWithFallback,
  storeNotification,
  sendFullNotification,
};