import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, pushData, removeData } from '../firebase';

const router = Router();

// GET /api/messages/conversations
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const conversations = await listData(`conversations/${requesterId}`);
    conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await getData(`users/${conv.otherUserId}`);
        return {
          ...conv,
          otherUser: otherUser ? { id: otherUser.id, name: otherUser.name, avatarUrl: otherUser.avatarUrl, role: otherUser.role } : null
        };
      })
    );

    res.json({ success: true, conversations: enrichedConversations });
  } catch (err) {
    console.error('[Messages] Get conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/:conversationId
router.get('/:conversationId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { conversationId } = req.params;
    const conversation = await getData(`messages/${conversationId}`);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.participants.includes(requesterId)) {
      return res.status(403).json({ error: 'Forbidden - Not a participant in this conversation' });
    }

    const messages = await listData(`messages/${conversationId}/threads`);
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const unreadMessages = messages.filter(m => m.recipientId === requesterId && !m.read);
    const markReadPromises = unreadMessages.map(m => 
      setData(`messages/${conversationId}/threads/${m.id}`, { ...m, read: true, readAt: new Date().toISOString() })
    );
    await Promise.all(markReadPromises);

    res.json({ success: true, messages });
  } catch (err) {
    console.error('[Messages] Get thread error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages
router.post('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { recipientId, content } = req.body;
    if (!recipientId || !content) {
      return res.status(400).json({ error: 'Recipient ID and message content are required' });
    }

    const sender = await getData(`users/${requesterId}`);
    const recipient = await getData(`users/${recipientId}`);
    
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const participantIds = [requesterId, recipientId].sort();
    const conversationId = `conv_${participantIds.join('_')}`;
    
    const message = {
      id: id('msg'),
      senderId: requesterId,
      senderName: sender.name,
      recipientId,
      content,
      read: false,
      createdAt: new Date().toISOString()
    };

    await setData(`messages/${conversationId}/threads/${message.id}`, message);

    await setData(`conversations/${requesterId}/${conversationId}`, {
      id: conversationId,
      otherUserId: recipientId,
      lastMessage: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      lastMessageAt: message.createdAt,
      unreadCount: 0
    });

    const existingRecipientConv = await getData(`conversations/${recipientId}/${conversationId}`);
    await setData(`conversations/${recipientId}/${conversationId}`, {
      id: conversationId,
      otherUserId: requesterId,
      lastMessage: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      lastMessageAt: message.createdAt,
      unreadCount: (existingRecipientConv?.unreadCount || 0) + 1
    });

    await setData(`messages/${conversationId}`, { participants: participantIds });

    res.json({ success: true, message, conversationId });
  } catch (err) {
    console.error('[Messages] Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/messages/:conversationId/:messageId
router.delete('/:conversationId/:messageId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { conversationId, messageId } = req.params;
    const message = await getData(`messages/${conversationId}/threads/${messageId}`);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== requesterId) {
      return res.status(403).json({ error: 'Forbidden - Can only delete your own messages' });
    }

    await removeData(`messages/${conversationId}/threads/${messageId}`);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('[Messages] Delete message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;