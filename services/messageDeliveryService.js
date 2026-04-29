/**
 * Message Delivery Status Service
 * Tracks read/delivered status for messages
 */

import { getRecord, updateRecord, queryRecords } from '../utils/firebaseDb.js';
import { emitToUser } from '../utils/socket.js';
import { logger } from '../utils/logger.js';

/**
 * Message delivery statuses
 */
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

/**
 * Mark message as delivered
 */
export const markMessageAsDelivered = async (messageId, recipientId) => {
  try {
    const message = await getRecord(`messages/${messageId}`);
    
    if (!message) {
      return { success: false, error: 'Message not found' };
    }
    
    // Update delivery status
    const deliveredAt = new Date().toISOString();
    const deliveryStatus = message.delivery_status || {};
    
    deliveryStatus[recipientId] = {
      status: MESSAGE_STATUS.DELIVERED,
      deliveredAt,
    };
    
    await updateRecord(`messages/${messageId}`, {
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString(),
    });
    
    // Emit status update to sender
    emitToUser(message.sender_id, 'message:delivered', {
      messageId,
      recipientId,
      deliveredAt,
    });
    
    logger.info(`Message ${messageId} marked as delivered to ${recipientId}`);
    
    return { success: true, deliveredAt };
  } catch (error) {
    logger.error('Error marking message as delivered', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId, recipientId) => {
  try {
    const message = await getRecord(`messages/${messageId}`);
    
    if (!message) {
      return { success: false, error: 'Message not found' };
    }
    
    // Update read status
    const readAt = new Date().toISOString();
    const deliveryStatus = message.delivery_status || {};
    
    deliveryStatus[recipientId] = {
      status: MESSAGE_STATUS.READ,
      readAt,
      deliveredAt: deliveryStatus[recipientId]?.deliveredAt || readAt,
    };
    
    // Add to read_by array if not already there
    const readBy = message.read_by || [];
    if (!readBy.includes(recipientId)) {
      readBy.push(recipientId);
    }
    
    await updateRecord(`messages/${messageId}`, {
      delivery_status: deliveryStatus,
      read_by: readBy,
      updated_at: new Date().toISOString(),
    });
    
    // Emit status update to sender
    emitToUser(message.sender_id, 'message:read', {
      messageId,
      recipientId,
      readAt,
    });
    
    logger.info(`Message ${messageId} marked as read by ${recipientId}`);
    
    return { success: true, readAt };
  } catch (error) {
    logger.error('Error marking message as read', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get message delivery status
 */
export const getMessageDeliveryStatus = async (messageId) => {
  try {
    const message = await getRecord(`messages/${messageId}`);
    
    if (!message) {
      return { success: false, error: 'Message not found' };
    }
    
    const deliveryStatus = message.delivery_status || {};
    const readBy = message.read_by || [];
    
    return {
      success: true,
      messageId,
      deliveryStatus,
      readBy,
      summary: {
        total: Object.keys(deliveryStatus).length,
        sent: Object.values(deliveryStatus).filter(s => s.status === MESSAGE_STATUS.SENT).length,
        delivered: Object.values(deliveryStatus).filter(s => s.status === MESSAGE_STATUS.DELIVERED).length,
        read: Object.values(deliveryStatus).filter(s => s.status === MESSAGE_STATUS.READ).length,
        failed: Object.values(deliveryStatus).filter(s => s.status === MESSAGE_STATUS.FAILED).length,
      }
    };
  } catch (error) {
    logger.error('Error getting message delivery status', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get delivery statistics for a user
 */
export const getUserDeliveryStats = async (userId) => {
  try {
    const messages = await queryRecords('messages', (m) => m.sender_id === userId);
    
    const stats = {
      totalMessages: messages.length,
      totalRecipients: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      averageDeliveryTime: 0,
    };
    
    let totalDeliveryTime = 0;
    let deliveredCount = 0;
    
    messages.forEach(message => {
      const deliveryStatus = message.delivery_status || {};
      stats.totalRecipients += Object.keys(deliveryStatus).length;
      
      Object.values(deliveryStatus).forEach(status => {
        if (status.status === MESSAGE_STATUS.DELIVERED) {
          stats.delivered++;
        } else if (status.status === MESSAGE_STATUS.READ) {
          stats.read++;
        } else if (status.status === MESSAGE_STATUS.FAILED) {
          stats.failed++;
        }
        
        // Calculate average delivery time
        if (status.deliveredAt && message.created_at) {
          const deliveryTime = new Date(status.deliveredAt) - new Date(message.created_at);
          totalDeliveryTime += deliveryTime;
          deliveredCount++;
        }
      });
    });
    
    if (deliveredCount > 0) {
      stats.averageDeliveryTime = Math.round(totalDeliveryTime / deliveredCount / 1000); // in seconds
    }
    
    return { success: true, stats };
  } catch (error) {
    logger.error('Error getting user delivery stats', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Mark message as failed
 */
export const markMessageAsFailed = async (messageId, recipientId, reason) => {
  try {
    const message = await getRecord(`messages/${messageId}`);
    
    if (!message) {
      return { success: false, error: 'Message not found' };
    }
    
    const failedAt = new Date().toISOString();
    const deliveryStatus = message.delivery_status || {};
    
    deliveryStatus[recipientId] = {
      status: MESSAGE_STATUS.FAILED,
      failedAt,
      reason,
    };
    
    await updateRecord(`messages/${messageId}`, {
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString(),
    });
    
    // Emit failure notification to sender
    emitToUser(message.sender_id, 'message:failed', {
      messageId,
      recipientId,
      reason,
      failedAt,
    });
    
    logger.warn(`Message ${messageId} failed to deliver to ${recipientId}: ${reason}`);
    
    return { success: true, failedAt };
  } catch (error) {
    logger.error('Error marking message as failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get unread messages for a user
 */
export const getUnreadMessages = async (userId) => {
  try {
    const messages = await queryRecords('messages', (m) => 
      m.recipient_id === userId || (m.class_id && m.sender_id !== userId)
    );
    
    const unreadMessages = messages.filter(m => {
      const deliveryStatus = m.delivery_status || {};
      const userStatus = deliveryStatus[userId];
      return !userStatus || userStatus.status !== MESSAGE_STATUS.READ;
    });
    
    return {
      success: true,
      unreadCount: unreadMessages.length,
      messages: unreadMessages.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        content: m.content,
        createdAt: m.created_at,
        status: (m.delivery_status || {})[userId]?.status || MESSAGE_STATUS.SENT,
      })),
    };
  } catch (error) {
    logger.error('Error getting unread messages', { error: error.message });
    return { success: false, error: error.message };
  }
};

export default {
  MESSAGE_STATUS,
  markMessageAsDelivered,
  markMessageAsRead,
  getMessageDeliveryStatus,
  getUserDeliveryStats,
  markMessageAsFailed,
  getUnreadMessages,
};
