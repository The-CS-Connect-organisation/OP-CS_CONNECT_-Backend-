import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, createRecord, updateRecord, deleteRecord, queryRecords } from '../utils/firebaseDb.js';

const router = Router();
router.use(requireAuth);

// GET /api/friends/requests — get incoming requests for current user
router.get('/requests', asyncHandler(async (req, res) => {
  const requests = await queryRecords('friend_requests', r =>
    r.to === req.user.id && r.status === 'pending'
  );
  requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, requests });
}));

// POST /api/friends/request — send a friend request
router.post('/request', asyncHandler(async (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId) throw new ApiError(400, 'toUserId is required');
  if (toUserId === req.user.id) throw new ApiError(400, 'Cannot send request to yourself');

  // Check if already exists
  const existing = await queryRecords('friend_requests', r =>
    ((r.from === req.user.id && r.to === toUserId) ||
     (r.from === toUserId && r.to === req.user.id)) &&
    r.status === 'pending'
  );
  if (existing.length > 0) {
    return res.json({ success: true, request: existing[0], alreadyExists: true });
  }

  // Check if already friends
  const alreadyFriends = await queryRecords('friend_requests', r =>
    ((r.from === req.user.id && r.to === toUserId) ||
     (r.from === toUserId && r.to === req.user.id)) &&
    r.status === 'accepted'
  );
  if (alreadyFriends.length > 0) {
    return res.json({ success: true, alreadyFriends: true });
  }

  const request = await createRecord('friend_requests', {
    from: req.user.id,
    fromName: req.user.name,
    fromRole: req.user.role,
    to: toUserId,
    status: 'pending',
  });

  // Notify via socket
  if (req.io) {
    req.io.to(`user:${toUserId}`).emit('friend:request', request);
  }

  res.status(201).json({ success: true, request });
}));

// POST /api/friends/accept/:requestId — accept a friend request
router.post('/accept/:requestId', asyncHandler(async (req, res) => {
  const existing = await getRecord(`friend_requests/${req.params.requestId}`);
  if (!existing) throw new ApiError(404, 'Request not found');
  if (existing.to !== req.user.id) throw new ApiError(403, 'Not your request');

  await updateRecord(`friend_requests/${req.params.requestId}`, {
    ...existing,
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  });

  // Notify the sender
  if (req.io) {
    req.io.to(`user:${existing.from}`).emit('friend:accepted', {
      requestId: req.params.requestId,
      by: { id: req.user.id, name: req.user.name, role: req.user.role },
    });
  }

  res.json({ success: true, contact: { id: existing.from, name: existing.fromName, role: existing.fromRole } });
}));

// DELETE /api/friends/request/:requestId — decline/cancel a request
router.delete('/request/:requestId', asyncHandler(async (req, res) => {
  const existing = await getRecord(`friend_requests/${req.params.requestId}`);
  if (!existing) throw new ApiError(404, 'Request not found');
  if (existing.to !== req.user.id && existing.from !== req.user.id) throw new ApiError(403, 'Forbidden');

  await deleteRecord(`friend_requests/${req.params.requestId}`);
  res.json({ success: true });
}));

// GET /api/friends — get accepted friends list
router.get('/', asyncHandler(async (req, res) => {
  const accepted = await queryRecords('friend_requests', r =>
    (r.from === req.user.id || r.to === req.user.id) && r.status === 'accepted'
  );

  const friends = accepted.map(r => {
    if (r.from === req.user.id) {
      return { id: r.to, requestId: r.id };
    }
    return { id: r.from, name: r.fromName, role: r.fromRole, requestId: r.id };
  });

  res.json({ success: true, friends });
}));

export default router;
