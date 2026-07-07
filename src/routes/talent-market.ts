import { Router } from 'express';
import { getData, setData, listData, updateData, id, queryData } from '../firebase';
import jwt from 'jsonwebtoken';

const router = Router();

function getJwtSecret(): string {
  return process.env.JWT_SECRET || (() => {
    console.warn('[talent-market] JWT_SECRET not set, tokens will fail');
    return 'eduvault-fallback-';
  })();
}

// --- Auth Middleware ---
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Role check middleware factory
function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Strip HTML tags from string input to prevent XSS
function sanitize(str: any): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

// Auto-close expired listings (BUG-6 fix)
async function autoCloseExpired(): Promise<number> {
  const now = new Date();
  const listings = await getData('auctionListings');
  if (!listings) return 0;
  const entries = typeof listings === 'object' && !Array.isArray(listings)
    ? Object.entries(listings)
    : [];
  let closed = 0;
  for (const [key, listing] of entries) {
    const l = listing as any;
    if (l.status === 'open' && l.deadline && new Date(l.deadline) < now) {
      l.status = 'closed';
      l.updatedAt = now.toISOString();
      await setData(`auctionListings/${key}`, l);
      closed++;
    }
  }
  return closed;
}

// --- Auction Listings ---
// GET /api/talent-market/listings - Get all active listings
router.get('/listings', authMiddleware, async (req, res) => {
  try {
    await autoCloseExpired();
    const { status, creatorId } = req.query;
    let result: any[];
    if (status) {
      // BUG-10: Use Firebase query instead of reading all listings
      result = await queryData('auctionListings', 'status', status as string);
    } else {
      result = await listData('auctionListings');
    }
    if (creatorId) result = result.filter((l: any) => l.createdBy === creatorId);
    result.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/talent-market/listings/:id - Get a single listing with submissions
router.get('/listings/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await getData(`auctionListings/${req.params.id}`);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    // Auto-close if deadline passed (BUG-6 fix)
    if (listing.status === 'open' && listing.deadline && new Date(listing.deadline) < new Date()) {
      listing.status = 'closed';
      listing.updatedAt = new Date().toISOString();
      await setData(`auctionListings/${req.params.id}`, listing);
    }
    res.json(listing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/talent-market/listings - Create a new listing (manager/teacher/admin)
router.post('/listings', authMiddleware, requireRole('manager', 'admin', 'teacher'), async (req, res) => {
  try {
    // Validate deadline (BUG-6 fix)
    if (req.body.deadline) {
      const deadlineDate = new Date(req.body.deadline);
      if (isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ error: 'Invalid deadline date format' });
      }
      if (deadlineDate < new Date()) {
        return res.status(400).json({ error: 'Deadline cannot be in the past' });
      }
    }

    const listing = {
      id: id('ah'),
      ...req.body,
      // Strip rolesNeeded as it's dead/unused data (BUG-5 fix)
      rolesNeeded: undefined,
      submissions: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setData(`auctionListings/${listing.id}`, listing);
    res.status(201).json(listing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/talent-market/listings/:id - Update a listing
router.put('/listings/:id', authMiddleware, requireRole('manager', 'admin', 'teacher'), async (req, res) => {
  try {
    const existing = await getData(`auctionListings/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Listing not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`auctionListings/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/talent-market/listings/:id - Delete a listing
router.delete('/listings/:id', authMiddleware, requireRole('manager', 'admin', 'teacher'), async (req, res) => {
  try {
    await setData(`auctionListings/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// --- Submissions ---
// POST /api/talent-market/listings/:id/submit - Student submits their portfolio/interest
router.post('/listings/:id/submit', authMiddleware, async (req, res) => {
  try {
    const listing = await getData(`auctionListings/${req.params.id}`);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'open') return res.status(400).json({ error: 'Listing is not open for submissions' });
    // BUG-6 fix: Reject submission if deadline has passed
    if (listing.deadline && new Date(listing.deadline) < new Date()) {
      return res.status(400).json({ error: 'Submission deadline has passed' });
    }

    const { studentId, studentName, portfolioUrl, message, talentTags } = req.body;
    
    // BUG-8 fix: Only block duplicate if previous submission was pending/accepted (allow re-submit after rejection)
    const prevSubmission = listing.submissions?.find((s: any) => s.studentId === studentId);
    if (prevSubmission && prevSubmission.status !== 'rejected') {
      return res.status(400).json({ error: 'You have already submitted to this listing' });
    }

    // BUG-9 fix: Sanitize user input to prevent XSS
    const submission = {
      id: id('sub'),
      studentId,
      studentName: sanitize(studentName),
      portfolioUrl: sanitize(portfolioUrl || ''),
      message: sanitize(message || ''),
      talentTags: talentTags || [],
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    listing.submissions = [...(listing.submissions || []), submission];
    await setData(`auctionListings/${req.params.id}`, listing);
    res.status(201).json(submission);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// PUT /api/talent-market/listings/:id/submissions/:submissionId/status - Accept/Reject a submission
router.put('/listings/:id/submissions/:submissionId/status', authMiddleware, requireRole('manager', 'admin', 'teacher'), async (req, res) => {
  try {
    const listing = await getData(`auctionListings/${req.params.id}`);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const { status, feedback } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or rejected' });
    }

    const subIdx = listing.submissions?.findIndex((s: any) => s.id === req.params.submissionId);
    if (subIdx === -1 || subIdx === undefined) return res.status(404).json({ error: 'Submission not found' });

    listing.submissions[subIdx].status = status;
    listing.submissions[subIdx].reviewedAt = new Date().toISOString();
    if (feedback) listing.submissions[subIdx].feedback = feedback;

    await setData(`auctionListings/${req.params.id}`, listing);
    res.json(listing.submissions[subIdx]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update submission status' });
  }
});

// GET /api/talent-market/my-submissions/:studentId - Get all listings a student has submitted to
router.get('/my-submissions/:studentId', authMiddleware, async (req, res) => {
  try {
    const listings = await listData('auctionListings');
    const myListings = listings.filter((l: any) =>
      l.submissions?.some((s: any) => s.studentId === req.params.studentId)
    ).map((l: any) => ({
      ...l,
      mySubmission: l.submissions?.find((s: any) => s.studentId === req.params.studentId),
      submissions: undefined, // Don't send other submissions
    }));
    res.json(myListings);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// --- Universal Inbox ---
// GET /api/talent-market/inbox/:userId - Get all inbox items for a user
router.get('/inbox/:userId', authMiddleware, async (req, res) => {
  try {
    const inbox = await listData('universalInbox');
    const userInbox = inbox
      .filter((item: any) => item.userId === req.params.userId)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(userInbox);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// POST /api/talent-market/inbox - Create an inbox item
router.post('/inbox', authMiddleware, async (req, res) => {
  try {
    const item = {
      id: id('inbox'),
      ...req.body,
      read: false,
      timestamp: new Date().toISOString(),
    };
    await setData(`universalInbox/${item.id}`, item);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create inbox item' });
  }
});

// PUT /api/talent-market/inbox/:id/read - Mark inbox item as read
router.put('/inbox/:id/read', authMiddleware, async (req, res) => {
  try {
    const item = await getData(`universalInbox/${req.params.id}`);
    if (!item) return res.status(404).json({ error: 'Inbox item not found' });
    await updateData(`universalInbox/${req.params.id}`, { read: true });
    res.json({ ...item, read: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PUT /api/talent-market/inbox/read-all/:userId - Mark all inbox items as read for a user
router.put('/inbox/read-all/:userId', authMiddleware, async (req, res) => {
  try {
    const inbox = await listData('universalInbox');
    const userItems = inbox.filter((item: any) => item.userId === req.params.userId && !item.read);
    for (const item of userItems) {
      await updateData(`universalInbox/${item.id}`, { read: true });
    }
    res.json({ success: true, count: userItems.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/talent-market/inbox/:id - Delete inbox item
router.delete('/inbox/:id', authMiddleware, async (req, res) => {
  try {
    await setData(`universalInbox/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete inbox item' });
  }
});

export default router;
