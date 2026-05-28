import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Health Records ---
router.get('/records', async (req, res) => {
  try {
    let records = await listData('healthRecords');
    const { studentId, condition } = req.query;
    if (studentId) records = records.filter((r: any) => r.studentId === studentId);
    if (condition) records = records.filter((r: any) => r.condition === condition);
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

router.post('/records', async (req, res) => {
  try {
    const { studentId, condition, medications, allergies, notes } = req.body;
    if (!studentId || !condition) return res.status(400).json({ error: 'Missing required fields' });
    const record = { id: id('hr'), studentId, condition, medications: medications || [], allergies: allergies || [], notes: notes || '', createdAt: new Date().toISOString() };
    await setData(`healthRecords/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create health record' });
  }
});

router.put('/records/:id', async (req, res) => {
  try {
    const existing = await getData(`healthRecords/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Health record not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`healthRecords/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update health record' });
  }
});

// --- Immunisations ---
router.get('/immunisations', async (req, res) => {
  try {
    let immunisations = await listData('immunisations');
    const { studentId } = req.query;
    if (studentId) immunisations = immunisations.filter((i: any) => i.studentId === studentId);
    res.json(immunisations.sort((a: any, b: any) => new Date(b.dateGiven).getTime() - new Date(a.dateGiven).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch immunisation records' });
  }
});

router.post('/immunisations', async (req, res) => {
  try {
    const { studentId, vaccine, dateGiven, nextDue, administeredBy } = req.body;
    if (!studentId || !vaccine || !dateGiven) return res.status(400).json({ error: 'Missing required fields' });
    const immunisation = { id: id('imm'), studentId, vaccine, dateGiven, nextDue: nextDue || '', administeredBy: administeredBy || '', createdAt: new Date().toISOString() };
    await setData(`immunisations/${immunisation.id}`, immunisation);
    res.status(201).json(immunisation);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create immunisation record' });
  }
});

// --- IEP Plans ---
router.get('/iep', async (req, res) => {
  try {
    let plans = await listData('iepPlans');
    const { studentId, status } = req.query;
    if (studentId) plans = plans.filter((p: any) => p.studentId === studentId);
    if (status) plans = plans.filter((p: any) => p.status === status);
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch IEP plans' });
  }
});

router.post('/iep', async (req, res) => {
  try {
    const { studentId, accommodations, goals, reviewDate, status } = req.body;
    if (!studentId || !accommodations) return res.status(400).json({ error: 'Missing required fields' });
    const plan = { id: id('iep'), studentId, accommodations, goals: goals || [], reviewDate: reviewDate || '', status: status || 'active', createdAt: new Date().toISOString() };
    await setData(`iepPlans/${plan.id}`, plan);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create IEP plan' });
  }
});

router.put('/iep/:id', async (req, res) => {
  try {
    const existing = await getData(`iepPlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'IEP plan not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`iepPlans/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update IEP plan' });
  }
});

// --- Health Screenings ---
router.get('/screenings', async (req, res) => {
  try {
    let screenings = await listData('healthScreenings');
    const { studentId, type, needsFollowUp } = req.query;
    if (studentId) screenings = screenings.filter((s: any) => s.studentId === studentId);
    if (type) screenings = screenings.filter((s: any) => s.type === type);
    if (needsFollowUp !== undefined) screenings = screenings.filter((s: any) => String(s.needsFollowUp) === needsFollowUp);
    res.json(screenings.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch health screenings' });
  }
});

router.post('/screenings', async (req, res) => {
  try {
    const { studentId, type, date, results, needsFollowUp } = req.body;
    if (!studentId || !type || !date) return res.status(400).json({ error: 'Missing required fields' });
    const screening = { id: id('hsc'), studentId, type, date, results: results || '', needsFollowUp: needsFollowUp || false, createdAt: new Date().toISOString() };
    await setData(`healthScreenings/${screening.id}`, screening);
    res.status(201).json(screening);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create health screening' });
  }
});

// --- Nurse Visits ---
router.get('/visits', async (req, res) => {
  try {
    let visits = await listData('nurseVisits');
    const { studentId } = req.query;
    if (studentId) visits = visits.filter((v: any) => v.studentId === studentId);
    res.json(visits.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch nurse visits' });
  }
});

router.post('/visits', async (req, res) => {
  try {
    const { studentId, date, symptoms, treatment, followUp } = req.body;
    if (!studentId || !date || !symptoms) return res.status(400).json({ error: 'Missing required fields' });
    const visit = { id: id('nv'), studentId, date, symptoms, treatment: treatment || '', followUp: followUp || '', createdAt: new Date().toISOString() };
    await setData(`nurseVisits/${visit.id}`, visit);
    res.status(201).json(visit);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create nurse visit' });
  }
});

// --- Dietary Profiles ---
router.get('/dietary', async (req, res) => {
  try {
    let profiles = await listData('dietaryProfiles');
    const { studentId } = req.query;
    if (studentId) profiles = profiles.filter((p: any) => p.studentId === studentId);
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dietary profiles' });
  }
});

router.post('/dietary', async (req, res) => {
  try {
    const { studentId, restrictions, allergies, preferences } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Missing required fields' });
    const profile = { id: id('dp'), studentId, restrictions: restrictions || [], allergies: allergies || [], preferences: preferences || '', createdAt: new Date().toISOString() };
    await setData(`dietaryProfiles/${profile.id}`, profile);
    res.status(201).json(profile);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create dietary profile' });
  }
});

router.put('/dietary/:id', async (req, res) => {
  try {
    const existing = await getData(`dietaryProfiles/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Dietary profile not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`dietaryProfiles/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update dietary profile' });
  }
});

export default router;
