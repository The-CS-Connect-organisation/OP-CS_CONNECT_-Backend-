import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, updateRecord, deleteRecord } from '../utils/firebaseDb.js';

/**
 * @desc    Get all clubs
 * @route   GET /api/school/clubs
 */
export const getAllClubs = asyncHandler(async (req, res) => {
  const clubs = await getRecords('communities');
  res.json({ success: true, clubs });
});

/**
 * @desc    Create a new club
 * @route   POST /api/school/clubs
 */
export const createClub = asyncHandler(async (req, res) => {
  const { name, type, color } = req.body;
  if (!name || !type) throw new ApiError(400, 'Name and Type are required');

  const clubId = `club_${Date.now()}`;
  const newClub = {
    id: clubId,
    name,
    type,
    color: color || '#6366f1',
    creator_id: req.user.id,
    members: [req.user.id],
    channels: ['general', 'announcements'],
    is_private: req.body.isPrivate || false,
    created_at: new Date().toISOString()
  };

  await updateRecord(`communities/${clubId}`, newClub);
  res.status(201).json({ success: true, club: newClub });
});

/**
 * @desc    Join a club
 * @route   POST /api/school/clubs/:clubId/join
 */
export const joinClub = asyncHandler(async (req, res) => {
  const club = await getRecord(`communities/${req.params.clubId}`);
  if (!club) throw new ApiError(404, 'Club not found');

  const members = Array.isArray(club.members) ? club.members : [];
  if (members.includes(req.user.id)) {
    return res.json({ success: true, message: 'Already a member', club });
  }

  members.push(req.user.id);
  await updateRecord(`communities/${req.params.clubId}`, { members });
  
  res.json({ success: true, message: 'Joined successfully' });
});

/**
 * @desc    Add a message to a club channel
 * @route   POST /api/school/clubs/:clubId/messages
 */
export const sendClubMessage = asyncHandler(async (req, res) => {
  const { channel, content } = req.body;
  const clubId = req.params.clubId;

  const messageId = `msg_${Date.now()}`;
  const message = {
    id: messageId,
    club_id: clubId,
    channel: channel || 'general',
    sender_id: req.user.id,
    sender_name: req.user.name,
    content,
    created_at: new Date().toISOString()
  };

  await updateRecord(`community_messages/${clubId}/${messageId}`, message);
  
  // Real-time broadcast
  if (req.io) {
    req.io.to(`club:${clubId}`).emit('club:message', message);
  }

  res.status(201).json({ success: true, message });
});
