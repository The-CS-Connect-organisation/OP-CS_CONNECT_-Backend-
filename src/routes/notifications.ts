import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, pushData, removeData } from '../firebase';

const router = Router();

// GET /api/notifications/:userId
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { userId } = req.params;
    if (requesterId !== userId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Cannot access other users\' notifications' });
      }
    }

    const notifications = await listData(`notifications/${userId}`);
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ success: true, notifications });
  } catch (err) {
    console.error('[Notifications] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications
router.post('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'teacher', 'coordinator'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions to send notifications' });
    }

    const { recipientIds, title, message, type = 'general', link = null } = req.body;
    if (!recipientIds || !Array.isArray(recipientIds) || !title || !message) {
      return res.status(400).json({ error: 'Recipient IDs, title, and message are required' });
    }

    const createdNotifications = [];
    for (const userId of recipientIds) {
      const notification = {
        id: id('notif'),
        title,
        message,
        type,
        link,
        read: false,
        senderId: requesterId,
        senderName: requester.name,
        createdAt: new Date().toISOString()
      };
      
      await setData(`notifications/${userId}/${notification.id}`, notification);
      createdNotifications.push(notification);
    }

    res.json({ success: true, notifications: createdNotifications });
  } catch (err) {
    console.error('[Notifications] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:userId/:id/read
router.put('/:userId/:id/read', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { userId, id } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Can only mark your own notifications as read' });
    }

    const notification = await getData(`notifications/${userId}/${id}`);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = { ...notification, read: true, readAt: new Date().toISOString() };
    await setData(`notifications/${userId}/${id}`, updatedNotification);

    res.json({ success: true, notification: updatedNotification });
  } catch (err) {
    console.error('[Notifications] Mark as read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notifications/:userId/:id
router.delete('/:userId/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { userId, id } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Can only delete your own notifications' });
    }

    await removeData(`notifications/${userId}/${id}`);
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('[Notifications] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:userId/mark-all-read
router.put('/:userId/mark-all-read', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { userId } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Can only update your own notifications' });
    }

    const notifications = await listData(`notifications/${userId}`);
    const updatePromises = notifications
      .filter(n => !n.read)
      .map(n => setData(`notifications/${userId}/${n.id}`, { ...n, read: true, readAt: new Date().toISOString() }));
    
    await Promise.all(updatePromises);
    res.json({ success: true, updatedCount: updatePromises.length });
  } catch (err) {
    console.error('[Notifications] Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;