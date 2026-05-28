import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Applications ---
router.get('/applications', async (_req, res) => {
  try {
    const apps = await listData('enrolmentApplications');
    const { status, grade } = _req.query;
    let filtered = apps;
    if (status) filtered = filtered.filter((a: any) => a.status === status);
    if (grade) filtered = filtered.filter((a: any) => a.grade === grade);
    res.json(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.post('/applications', async (req, res) => {
  try {
    const app = { id: id('enrol'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`enrolmentApplications/${app.id}`, app);
    res.status(201).json(app);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create application' });
  }
});

router.put('/applications/:id', async (req, res) => {
  try {
    const existing = await getData(`enrolmentApplications/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Application not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`enrolmentApplications/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

router.put('/applications/:id/:action', async (req, res) => {
  try {
    const { action } = req.params;
    if (!['approve', 'reject', 'waitlist'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve, reject, or waitlist' });
    }
    const existing = await getData(`enrolmentApplications/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Application not found' });
    existing.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'waitlisted';
    existing.actionedAt = new Date().toISOString();
    existing.actionedBy = req.body.actionedBy || 'system';
    await setData(`enrolmentApplications/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// --- Capacity ---
router.get('/capacity', async (_req, res) => {
  try {
    const capacity = await listData('schoolCapacity');
    const { grade } = _req.query;
    if (grade) return res.json(capacity.filter((c: any) => c.grade === grade));
    res.json(capacity);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch capacity' });
  }
});

router.post('/capacity', async (req, res) => {
  try {
    const cap = { id: id('cap'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`schoolCapacity/${cap.id}`, cap);
    res.status(201).json(cap);
  } catch (e) {
    res.status(500).json({ error: 'Failed to set capacity' });
  }
});

// --- Offers ---
router.get('/offers', async (_req, res) => {
  try {
    const offers = await listData('admissionOffers');
    const { status, grade } = _req.query;
    let filtered = offers;
    if (status) filtered = filtered.filter((o: any) => o.status === status);
    if (grade) filtered = filtered.filter((o: any) => o.grade === grade);
    res.json(filtered.sort((a: any, b: any) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

router.post('/offers', async (req, res) => {
  try {
    const offer = { id: id('offer'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`admissionOffers/${offer.id}`, offer);
    res.status(201).json(offer);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

router.put('/offers/:id/:action', async (req, res) => {
  try {
    const { action } = req.params;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use accept or decline' });
    }
    const existing = await getData(`admissionOffers/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Offer not found' });
    existing.status = action === 'accept' ? 'accepted' : 'declined';
    existing.actionedAt = new Date().toISOString();
    await setData(`admissionOffers/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to process offer' });
  }
});

// --- Waitlist ---
router.get('/waitlist', async (_req, res) => {
  try {
    const waitlist = await listData('enrolmentWaitlist');
    const { grade } = _req.query;
    let filtered = waitlist;
    if (grade) filtered = filtered.filter((w: any) => w.grade === grade);
    res.json(filtered.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0)));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

router.post('/waitlist', async (req, res) => {
  try {
    const entry = { id: id('wl'), ...req.body, date: req.body.date || new Date().toISOString(), createdAt: new Date().toISOString() };
    await setData(`enrolmentWaitlist/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
});

router.put('/waitlist/:id', async (req, res) => {
  try {
    const existing = await getData(`enrolmentWaitlist/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Waitlist entry not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`enrolmentWaitlist/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update waitlist entry' });
  }
});

// --- Withdrawals ---
router.get('/withdrawals', async (_req, res) => {
  try {
    const withdrawals = await listData('studentWithdrawals');
    const { type } = _req.query;
    if (type) return res.json(withdrawals.filter((w: any) => w.type === type));
    res.json(withdrawals.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

router.post('/withdrawals', async (req, res) => {
  try {
    const withdrawal = { id: id('wd'), ...req.body, status: 'processed', createdAt: new Date().toISOString() };
    await setData(`studentWithdrawals/${withdrawal.id}`, withdrawal);
    await setData(`users/${req.body.studentId}/status`, 'withdrawn');
    res.status(201).json(withdrawal);
  } catch (e) {
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// --- Tours ---
router.get('/tours', async (_req, res) => {
  try {
    const tours = await listData('schoolTours');
    const { status, date } = _req.query;
    let filtered = tours;
    if (status) filtered = filtered.filter((t: any) => t.status === status);
    if (date) filtered = filtered.filter((t: any) => t.date === date);
    res.json(filtered.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tours' });
  }
});

router.post('/tours', async (req, res) => {
  try {
    const tour = { id: id('tour'), ...req.body, status: req.body.status || 'scheduled', createdAt: new Date().toISOString() };
    await setData(`schoolTours/${tour.id}`, tour);
    res.status(201).json(tour);
  } catch (e) {
    res.status(500).json({ error: 'Failed to book tour' });
  }
});

// --- Scholarships ---
router.get('/scholarships', async (_req, res) => {
  try {
    const scholarships = await listData('scholarships');
    res.json(scholarships.sort((a: any, b: any) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scholarships' });
  }
});

router.post('/scholarships', async (req, res) => {
  try {
    const scholarship = { id: id('scholar'), ...req.body, available: req.body.available ?? true, createdAt: new Date().toISOString() };
    await setData(`scholarships/${scholarship.id}`, scholarship);
    res.status(201).json(scholarship);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create scholarship' });
  }
});

export default router;
