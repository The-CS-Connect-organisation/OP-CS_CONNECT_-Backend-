import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Discipline Incidents ---
router.get('/incidents', async (req, res) => {
  try {
    let incidents = await listData('disciplineIncidents');
    const { studentId, category, severity, status } = req.query;
    if (studentId) incidents = incidents.filter((i: any) => i.studentId === studentId);
    if (category) incidents = incidents.filter((i: any) => i.category === category);
    if (severity) incidents = incidents.filter((i: any) => i.severity === severity);
    if (status) incidents = incidents.filter((i: any) => i.status === status);
    res.json(incidents.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch discipline incidents' });
  }
});

router.post('/incidents', async (req, res) => {
  try {
    const { studentId, date, category, description, location, severity, reportedBy } = req.body;
    if (!studentId || !date || !category || !description) return res.status(400).json({ error: 'Missing required fields' });
    const incident = { id: id('inc'), studentId, date, category, description, location: location || '', severity: severity || 'minor', reportedBy: reportedBy || '', status: 'open', createdAt: new Date().toISOString() };
    await setData(`disciplineIncidents/${incident.id}`, incident);
    res.status(201).json(incident);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create discipline incident' });
  }
});

router.put('/incidents/:id', async (req, res) => {
  try {
    const existing = await getData(`disciplineIncidents/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Incident not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`disciplineIncidents/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update discipline incident' });
  }
});

router.put('/incidents/:id/resolve', async (req, res) => {
  try {
    const existing = await getData(`disciplineIncidents/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Incident not found' });
    existing.status = 'resolved';
    existing.actionsTaken = req.body.actionsTaken || [];
    existing.resolvedBy = req.body.resolvedBy;
    existing.resolvedAt = new Date().toISOString();
    await setData(`disciplineIncidents/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// --- Behaviour Intervention Plans ---
router.get('/bip', async (req, res) => {
  try {
    let plans = await listData('behaviourInterventionPlans');
    const { studentId, status } = req.query;
    if (studentId) plans = plans.filter((p: any) => p.studentId === studentId);
    if (status) plans = plans.filter((p: any) => p.status === status);
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch BIPs' });
  }
});

router.post('/bip', async (req, res) => {
  try {
    const { studentId, targetBehaviours, replacementBehaviours, strategies, goals, reviewDate } = req.body;
    if (!studentId || !targetBehaviours) return res.status(400).json({ error: 'Missing required fields' });
    const plan = { id: id('bip'), studentId, targetBehaviours, replacementBehaviours: replacementBehaviours || [], strategies: strategies || [], goals: goals || [], reviewDate: reviewDate || '', status: 'active', createdAt: new Date().toISOString() };
    await setData(`behaviourInterventionPlans/${plan.id}`, plan);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create BIP' });
  }
});

router.put('/bip/:id', async (req, res) => {
  try {
    const existing = await getData(`behaviourInterventionPlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'BIP not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`behaviourInterventionPlans/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update BIP' });
  }
});

router.post('/bip/:id/progress', async (req, res) => {
  try {
    const existing = await getData(`behaviourInterventionPlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'BIP not found' });
    const { date, observed, notes } = req.body;
    if (!date || !observed) return res.status(400).json({ error: 'Missing required fields' });
    const entry = { id: id('bprog'), date, observed, notes: notes || '', loggedAt: new Date().toISOString() };
    const progress = existing.progress || [];
    progress.push(entry);
    existing.progress = progress;
    existing.updatedAt = new Date().toISOString();
    await setData(`behaviourInterventionPlans/${req.params.id}`, existing);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log BIP progress' });
  }
});

// --- Detentions ---
router.get('/detentions', async (req, res) => {
  try {
    let detentions = await listData('detentions');
    const { studentId, status } = req.query;
    if (studentId) detentions = detentions.filter((d: any) => d.studentId === studentId);
    if (status) detentions = detentions.filter((d: any) => d.status === status);
    res.json(detentions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch detentions' });
  }
});

router.post('/detentions', async (req, res) => {
  try {
    const { studentId, date, time, duration, reason, assignedBy, status } = req.body;
    if (!studentId || !date || !reason) return res.status(400).json({ error: 'Missing required fields' });
    const detention = { id: id('det'), studentId, date, time: time || '', duration: duration || 30, reason, assignedBy: assignedBy || '', status: status || 'scheduled', createdAt: new Date().toISOString() };
    await setData(`detentions/${detention.id}`, detention);
    res.status(201).json(detention);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create detention' });
  }
});

router.put('/detentions/:id/:action', async (req, res) => {
  try {
    const existing = await getData(`detentions/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Detention not found' });
    const validActions: Record<string, string> = { served: 'served', missed: 'missed', cancelled: 'cancelled' };
    const action = req.params.action;
    if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });
    existing.status = action;
    existing.updatedAt = new Date().toISOString();
    if (action === 'served') existing.servedAt = new Date().toISOString();
    await setData(`detentions/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update detention' });
  }
});

// --- Positive Behaviour ---
router.get('/positive-behaviour', async (req, res) => {
  try {
    let records = await listData('positiveBehaviour');
    const { studentId, category } = req.query;
    if (studentId) records = records.filter((r: any) => r.studentId === studentId);
    if (category) records = records.filter((r: any) => r.category === category);
    res.json(records.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch positive behaviour records' });
  }
});

router.post('/positive-behaviour', async (req, res) => {
  try {
    const { studentId, date, description, category, acknowledgedBy } = req.body;
    if (!studentId || !date || !description) return res.status(400).json({ error: 'Missing required fields' });
    const record = { id: id('pb'), studentId, date, description, category: category || 'general', acknowledgedBy: acknowledgedBy || '', createdAt: new Date().toISOString() };
    await setData(`positiveBehaviour/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create positive behaviour record' });
  }
});

export default router;
