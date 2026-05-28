import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Clubs ---
router.get('/clubs', async (_req, res) => {
  try {
    const clubs = await listData('clubs');
    const activities = await listData('clubActivities');
    const enriched = clubs.map((c: any) => ({
      ...c,
      activities: activities.filter((a: any) => a.clubId === c.id),
      memberCount: c.members?.length || 0,
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

router.post('/clubs', async (req, res) => {
  try {
    const club = { id: id('club'), ...req.body, members: [], createdAt: new Date().toISOString() };
    await setData(`clubs/${club.id}`, club);
    res.status(201).json(club);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create club' });
  }
});

router.put('/clubs/:id', async (req, res) => {
  try {
    const existing = await getData(`clubs/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Club not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`clubs/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update club' });
  }
});

router.post('/clubs/:id/members', async (req, res) => {
  try {
    const club = await getData(`clubs/${req.params.id}`);
    if (!club) return res.status(404).json({ error: 'Club not found' });
    const { studentId } = req.body;
    club.members = [...(club.members || []), { studentId, joinedAt: new Date().toISOString() }];
    await setData(`clubs/${req.params.id}`, club);
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/clubs/:id/members/:studentId', async (req, res) => {
  try {
    const club = await getData(`clubs/${req.params.id}`);
    if (!club) return res.status(404).json({ error: 'Club not found' });
    club.members = (club.members || []).filter((m: any) => m.studentId !== req.params.studentId);
    await setData(`clubs/${req.params.id}`, club);
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// --- Club Activities ---
router.get('/activities', async (_req, res) => {
  try {
    const activities = await listData('clubActivities');
    const { clubId } = _req.query;
    if (clubId) return res.json(activities.filter((a: any) => a.clubId === clubId));
    res.json(activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.post('/activities', async (req, res) => {
  try {
    const activity = { id: id('act'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`clubActivities/${activity.id}`, activity);
    res.status(201).json(activity);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// --- Field Trips ---
router.get('/field-trips', async (_req, res) => {
  try {
    const trips = await listData('fieldTrips');
    res.json(trips.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch field trips' });
  }
});

router.post('/field-trips', async (req, res) => {
  try {
    const trip = { id: id('ft'), ...req.body, consent: [], createdAt: new Date().toISOString() };
    await setData(`fieldTrips/${trip.id}`, trip);
    res.status(201).json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create field trip' });
  }
});

router.put('/field-trips/:id', async (req, res) => {
  try {
    const existing = await getData(`fieldTrips/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Field trip not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`fieldTrips/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update field trip' });
  }
});

router.post('/field-trips/:id/consent/:studentId', async (req, res) => {
  try {
    const trip = await getData(`fieldTrips/${req.params.id}`);
    if (!trip) return res.status(404).json({ error: 'Field trip not found' });
    trip.consent = [...(trip.consent || []), { studentId: req.params.studentId, consentedAt: new Date().toISOString() }];
    await setData(`fieldTrips/${req.params.id}`, trip);
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// --- Elections ---
router.get('/elections', async (_req, res) => {
  try {
    const elections = await listData('elections');
    res.json(elections.sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch elections' });
  }
});

router.post('/elections', async (req, res) => {
  try {
    const election = { id: id('elec'), ...req.body, candidates: [], votes: [], createdAt: new Date().toISOString() };
    await setData(`elections/${election.id}`, election);
    res.status(201).json(election);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create election' });
  }
});

router.post('/elections/:id/nominate', async (req, res) => {
  try {
    const election = await getData(`elections/${req.params.id}`);
    if (!election) return res.status(404).json({ error: 'Election not found' });
    const nomination = { id: id('nom'), ...req.body, nominatedAt: new Date().toISOString() };
    election.candidates = [...(election.candidates || []), nomination];
    await setData(`elections/${req.params.id}`, election);
    res.status(201).json(nomination);
  } catch (e) {
    res.status(500).json({ error: 'Failed to nominate candidate' });
  }
});

router.post('/elections/:id/vote', async (req, res) => {
  try {
    const election = await getData(`elections/${req.params.id}`);
    if (!election) return res.status(404).json({ error: 'Election not found' });
    const { studentId, candidateId } = req.body;
    if ((election.votes || []).some((v: any) => v.studentId === studentId)) {
      return res.status(400).json({ error: 'Student already voted' });
    }
    const vote = { studentId, candidateId, votedAt: new Date().toISOString() };
    election.votes = [...(election.votes || []), vote];
    await setData(`elections/${req.params.id}`, election);
    res.status(201).json(vote);
  } catch (e) {
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

router.get('/elections/:id/results', async (req, res) => {
  try {
    const election = await getData(`elections/${req.params.id}`);
    if (!election) return res.status(404).json({ error: 'Election not found' });
    const results: Record<string, number> = {};
    (election.candidates || []).forEach((c: any) => { results[c.id || c.studentId] = 0; });
    (election.votes || []).forEach((v: any) => {
      if (results[v.candidateId] !== undefined) results[v.candidateId]++;
    });
    res.json({
      election: { id: election.id, title: election.title },
      totalVotes: (election.votes || []).length,
      results: Object.entries(results).map(([candidateId, count]) => ({
        candidateId,
        candidateName: (election.candidates || []).find((c: any) => (c.id || c.studentId) === candidateId)?.name || candidateId,
        votes: count,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// --- Service Hours ---
router.get('/service-hours', async (_req, res) => {
  try {
    const hours = await listData('serviceHours');
    const { studentId } = _req.query;
    if (studentId) return res.json(hours.filter((h: any) => h.studentId === studentId));
    res.json(hours.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch service hours' });
  }
});

router.post('/service-hours', async (req, res) => {
  try {
    const entry = { id: id('sh'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`serviceHours/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log service hours' });
  }
});

// --- Hobbies ---
router.get('/hobbies', async (_req, res) => {
  try {
    const hobbies = await listData('hobbies');
    const { studentId } = _req.query;
    if (studentId) return res.json(hobbies.filter((h: any) => h.studentId === studentId));
    res.json(hobbies);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch hobbies' });
  }
});

router.post('/hobbies', async (req, res) => {
  try {
    const hobby = { id: id('hob'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`hobbies/${hobby.id}`, hobby);
    res.status(201).json(hobby);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add hobby' });
  }
});

export default router;
