import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Counselling Sessions ---
router.get('/sessions', async (req, res) => {
  try {
    let sessions = await listData('counsellingSessions');
    const { studentId, counsellorId, status } = req.query;
    if (studentId) sessions = sessions.filter((s: any) => s.studentId === studentId);
    if (counsellorId) sessions = sessions.filter((s: any) => s.counsellorId === counsellorId);
    if (status) sessions = sessions.filter((s: any) => s.status === status);
    res.json(sessions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch counselling sessions' });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { studentId, counsellorId, date, type, notes, status } = req.body;
    if (!studentId || !counsellorId || !date || !type) return res.status(400).json({ error: 'Missing required fields' });
    const session = { id: id('cs'), studentId, counsellorId, date, type, notes: notes || '', status: status || 'scheduled', createdAt: new Date().toISOString() };
    await setData(`counsellingSessions/${session.id}`, session);
    res.status(201).json(session);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create counselling session' });
  }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const existing = await getData(`counsellingSessions/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Session not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`counsellingSessions/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update counselling session' });
  }
});

// --- Wellbeing Check-ins ---
router.get('/checkins', async (req, res) => {
  try {
    let checkins = await listData('wellbeingCheckins');
    const { studentId, date } = req.query;
    if (studentId) checkins = checkins.filter((c: any) => c.studentId === studentId);
    if (date) checkins = checkins.filter((c: any) => c.date === date);
    res.json(checkins.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

router.post('/checkins', async (req, res) => {
  try {
    const { studentId, date, mood, surveyResponses } = req.body;
    if (!studentId || !date) return res.status(400).json({ error: 'Missing required fields' });
    const checkin = { id: id('wbc'), studentId, date, mood: mood || '', surveyResponses: surveyResponses || {}, createdAt: new Date().toISOString() };
    await setData(`wellbeingCheckins/${checkin.id}`, checkin);
    res.status(201).json(checkin);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create check-in' });
  }
});

// --- Student Referrals ---
router.get('/referrals', async (req, res) => {
  try {
    let referrals = await listData('studentReferrals');
    const { studentId, referredBy, type, status } = req.query;
    if (studentId) referrals = referrals.filter((r: any) => r.studentId === studentId);
    if (referredBy) referrals = referrals.filter((r: any) => r.referredBy === referredBy);
    if (type) referrals = referrals.filter((r: any) => r.type === type);
    if (status) referrals = referrals.filter((r: any) => r.status === status);
    res.json(referrals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

router.post('/referrals', async (req, res) => {
  try {
    const { studentId, referredBy, referredTo, reason, type, status } = req.body;
    if (!studentId || !referredBy || !referredTo || !reason) return res.status(400).json({ error: 'Missing required fields' });
    const referral = { id: id('ref'), studentId, referredBy, referredTo, reason, type: type || '', status: status || 'pending', createdAt: new Date().toISOString() };
    await setData(`studentReferrals/${referral.id}`, referral);
    res.status(201).json(referral);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create referral' });
  }
});

router.put('/referrals/:id/:action', async (req, res) => {
  try {
    const existing = await getData(`studentReferrals/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Referral not found' });
    const action = req.params.action;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    existing.status = action === 'approve' ? 'approved' : 'rejected';
    existing.reviewedAt = new Date().toISOString();
    existing.reviewedBy = req.body.reviewedBy;
    await setData(`studentReferrals/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

// --- Coordinated Care Plans ---
router.get('/care-plans', async (req, res) => {
  try {
    let plans = await listData('carePlans');
    const { studentId, status } = req.query;
    if (studentId) plans = plans.filter((p: any) => p.studentId === studentId);
    if (status) plans = plans.filter((p: any) => p.status === status);
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch care plans' });
  }
});

router.post('/care-plans', async (req, res) => {
  try {
    const { studentId, teamMembers, goals, interventions, status } = req.body;
    if (!studentId || !goals) return res.status(400).json({ error: 'Missing required fields' });
    const plan = { id: id('cp'), studentId, teamMembers: teamMembers || [], goals, interventions: interventions || [], status: status || 'active', createdAt: new Date().toISOString() };
    await setData(`carePlans/${plan.id}`, plan);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create care plan' });
  }
});

router.put('/care-plans/:id', async (req, res) => {
  try {
    const existing = await getData(`carePlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Care plan not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`carePlans/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update care plan' });
  }
});

// --- MTSS Interventions ---
router.get('/mtss', async (req, res) => {
  try {
    let interventions = await listData('mtssInterventions');
    const { studentId, tier, status } = req.query;
    if (studentId) interventions = interventions.filter((i: any) => i.studentId === studentId);
    if (tier) interventions = interventions.filter((i: any) => i.tier === tier);
    if (status) interventions = interventions.filter((i: any) => i.status === status);
    res.json(interventions);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch MTSS interventions' });
  }
});

router.post('/mtss', async (req, res) => {
  try {
    const { studentId, tier, interventions, startDate, reviewDate, status } = req.body;
    if (!studentId || !tier || !interventions) return res.status(400).json({ error: 'Missing required fields' });
    const mtss = { id: id('mtss'), studentId, tier, interventions, startDate, reviewDate: reviewDate || '', status: status || 'active', createdAt: new Date().toISOString() };
    await setData(`mtssInterventions/${mtss.id}`, mtss);
    res.status(201).json(mtss);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create MTSS intervention' });
  }
});

router.put('/mtss/:id', async (req, res) => {
  try {
    const existing = await getData(`mtssInterventions/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'MTSS intervention not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`mtssInterventions/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update MTSS intervention' });
  }
});

// --- Grievances ---
router.get('/grievances', async (req, res) => {
  try {
    let grievances = await listData('grievances');
    const { studentId, category, status } = req.query;
    if (studentId) grievances = grievances.filter((g: any) => g.studentId === studentId);
    if (category) grievances = grievances.filter((g: any) => g.category === category);
    if (status) grievances = grievances.filter((g: any) => g.status === status);
    res.json(grievances.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch grievances' });
  }
});

router.post('/grievances', async (req, res) => {
  try {
    const { studentId, category, description, status } = req.body;
    if (!studentId || !category || !description) return res.status(400).json({ error: 'Missing required fields' });
    const grievance = { id: id('grv'), studentId, category, description, status: status || 'open', createdAt: new Date().toISOString() };
    await setData(`grievances/${grievance.id}`, grievance);
    res.status(201).json(grievance);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create grievance' });
  }
});

router.put('/grievances/:id/:action', async (req, res) => {
  try {
    const existing = await getData(`grievances/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Grievance not found' });
    const validActions: Record<string, string> = { open: 'open', investigating: 'investigating', resolved: 'resolved', closed: 'closed' };
    const action = req.params.action;
    if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });
    existing.status = action;
    existing.resolvedAt = action === 'resolved' || action === 'closed' ? new Date().toISOString() : existing.resolvedAt;
    existing.updatedAt = new Date().toISOString();
    await setData(`grievances/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update grievance' });
  }
});

// --- Counsellor Caseload ---
router.get('/caseload/:counsellorId', async (req, res) => {
  try {
    const { counsellorId } = req.params;
    const sessions = await listData('counsellingSessions');
    const referrals = await listData('studentReferrals');
    const carePlans = await listData('carePlans');
    const caseloadSessions = sessions.filter((s: any) => s.counsellorId === counsellorId);
    const caseloadReferrals = referrals.filter((r: any) => r.referredTo === counsellorId && r.status === 'approved');
    const caseloadPlans = carePlans.filter((p: any) => (p.teamMembers || []).includes(counsellorId));
    const uniqueStudents = new Set([
      ...caseloadSessions.map((s: any) => s.studentId),
      ...caseloadReferrals.map((r: any) => r.studentId),
      ...caseloadPlans.map((p: any) => p.studentId),
    ]);
    res.json({
      counsellorId,
      totalStudents: uniqueStudents.size,
      totalSessions: caseloadSessions.length,
      pendingReferrals: referrals.filter((r: any) => r.referredTo === counsellorId && r.status === 'pending').length,
      activeCarePlans: caseloadPlans.filter((p: any) => p.status === 'active').length,
      upcomingSessions: caseloadSessions.filter((s: any) => s.status === 'scheduled').length,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch caseload stats' });
  }
});

export default router;
