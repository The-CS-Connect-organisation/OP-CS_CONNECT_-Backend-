import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord } from '../utils/firebaseDb.js';
import { getIO } from '../utils/socket.js';

export const createLostItem = asyncHandler(async (req, res) => {
  const { type, title, description, category, location, date, imageUrl, contactInfo, isAnonymous } = req.body;

  const itemId = Date.now().toString();
  const item = {
    id: itemId,
    type,
    title,
    description,
    category: category || 'other',
    location,
    date,
    imageUrl: imageUrl || null,
    contactInfo: isAnonymous ? null : (contactInfo || null),
    isAnonymous: isAnonymous || false,
    reportedBy: req.user.id,
    reportedByName: req.user.name,
    status: 'open',
    claims: [],
    resolvedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createRecord(`lost_and_found/${itemId}`, item);

  // Emit real-time update
  const io = getIO();
  if (io) {
    io.emit('lost-found:new', item);
  }

  res.status(201).json({ success: true, item });
});

export const getLostItems = asyncHandler(async (req, res) => {
  const { type, category, status, date, page = 1, limit = 20 } = req.query;

  let items = await getRecords('lost_and_found');

  // Apply filters
  if (type) items = items.filter(i => i.type === type);
  if (category) items = items.filter(i => i.category === category);
  if (status) items = items.filter(i => i.status === status);
  if (date) items = items.filter(i => i.date === date);

  // Sort by date descending
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = items.length;
  const skip = (page - 1) * limit;
  const paginated = items.slice(skip, skip + limit);

  res.json({
    success: true,
    items: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export const getMyLostItems = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let items = await getRecords('lost_and_found');

  items = items.filter(i => i.reportedBy === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, items });
});

export const claimLostItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { claimantName, claimantEmail, description, proofDescription } = req.body;

  const item = await getRecord(`lost_and_found/${itemId}`);
  if (!item) throw new ApiError(404, 'Item not found');
  if (item.status !== 'open') throw new ApiError(400, 'Item is not available for claim');
  if (item.type !== 'found') throw new ApiError(400, 'Only found items can be claimed');

  const claim = {
    claimantId: req.user.id,
    claimantName,
    claimantEmail: claimantEmail || null,
    description: description || '',
    proofDescription: proofDescription || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const updatedClaims = [...(item.claims || []), claim];

  await updateRecord(`lost_and_found/${itemId}`, {
    claims: updatedClaims,
    status: 'claimed',
    updatedAt: new Date().toISOString(),
  });

  // Emit real-time update
  const io = getIO();
  if (io) {
    io.emit('lost-found:claimed', { itemId, claim });
  }

  res.status(201).json({ success: true, claim, message: 'Claim submitted for review' });
});

export const deleteLostItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const item = await getRecord(`lost_and_found/${itemId}`);

  if (!item) throw new ApiError(404, 'Item not found');

  // Only allow deletion by original reporter, admin, or manager
  if (item.reportedBy !== req.user.id && !['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized to delete this item');
  }

  await deleteRecord(`lost_and_found/${itemId}`);

  res.json({ success: true, message: 'Item deleted' });
});