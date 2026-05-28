import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Portfolio (full) ---
router.get('/:studentId', async (req, res) => {
  try {
    const [reflections, achievements, endorsements, collegeApps, resume, careerReadiness] = await Promise.all([
      listData('portfolioReflections'),
      listData('portfolioAchievements'),
      listData('portfolioEndorsements'),
      listData('collegeApplications'),
      getData('resumes'),
      listData('careerReadiness'),
    ]);
    const portfolio = {
      studentId: req.params.studentId,
      reflections: reflections.filter((r: any) => r.studentId === req.params.studentId),
      achievements: achievements.filter((a: any) => a.studentId === req.params.studentId),
      endorsements: endorsements.filter((e: any) => e.studentId === req.params.studentId),
      collegeApps: collegeApps.filter((c: any) => c.studentId === req.params.studentId),
      resume: (resume as any)?.[req.params.studentId] || null,
      careerReadiness: careerReadiness.filter((c: any) => c.studentId === req.params.studentId),
    };
    res.json(portfolio);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// --- Reflections ---
router.get('/:studentId/reflections', async (req, res) => {
  try {
    const reflections = await listData('portfolioReflections');
    res.json(reflections.filter((r: any) => r.studentId === req.params.studentId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reflections' });
  }
});

router.post('/:studentId/reflections', async (req, res) => {
  try {
    const entry = { id: id('ref'), studentId: req.params.studentId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`portfolioReflections/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add reflection' });
  }
});

// --- Achievements ---
router.post('/:studentId/achievements', async (req, res) => {
  try {
    const achievement = { id: id('ach'), studentId: req.params.studentId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`portfolioAchievements/${achievement.id}`, achievement);
    res.status(201).json(achievement);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add achievement' });
  }
});

// --- Endorsements ---
router.get('/:studentId/endorsements', async (req, res) => {
  try {
    const endorsements = await listData('portfolioEndorsements');
    res.json(endorsements.filter((e: any) => e.studentId === req.params.studentId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch endorsements' });
  }
});

router.post('/:studentId/endorsements', async (req, res) => {
  try {
    const endorsement = { id: id('end'), studentId: req.params.studentId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`portfolioEndorsements/${endorsement.id}`, endorsement);
    res.status(201).json(endorsement);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add endorsement' });
  }
});

// --- College Applications ---
router.get('/:studentId/college-apps', async (req, res) => {
  try {
    const apps = await listData('collegeApplications');
    res.json(apps.filter((a: any) => a.studentId === req.params.studentId)
      .sort((a: any, b: any) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch college applications' });
  }
});

router.post('/:studentId/college-apps', async (req, res) => {
  try {
    const app = { id: id('ca'), studentId: req.params.studentId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`collegeApplications/${app.id}`, app);
    res.status(201).json(app);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add college application' });
  }
});

router.put('/college-apps/:id', async (req, res) => {
  try {
    const existing = await getData(`collegeApplications/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Application not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`collegeApplications/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// --- Resume ---
router.get('/:studentId/resume', async (req, res) => {
  try {
    const resumes = await getData('resumes');
    res.json((resumes as any)?.[req.params.studentId] || null);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

router.post('/:studentId/resume', async (req, res) => {
  try {
    const resumes = (await getData('resumes')) || {};
    resumes[req.params.studentId] = { ...(resumes[req.params.studentId] || {}), ...req.body, updatedAt: new Date().toISOString() };
    await setData('resumes', resumes);
    res.json(resumes[req.params.studentId]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

// --- Career Readiness ---
router.get('/:studentId/career-readiness', async (req, res) => {
  try {
    const assessments = await listData('careerReadiness');
    res.json(assessments.filter((a: any) => a.studentId === req.params.studentId)
      .sort((a: any, b: any) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch career readiness' });
  }
});

router.post('/:studentId/career-readiness', async (req, res) => {
  try {
    const assessment = { id: id('cr'), studentId: req.params.studentId, ...req.body, assessedAt: new Date().toISOString() };
    await setData(`careerReadiness/${assessment.id}`, assessment);
    res.status(201).json(assessment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add assessment' });
  }
});

// --- Share Link ---
router.post('/:studentId/share', async (req, res) => {
  try {
    const share = {
      id: id('share'),
      studentId: req.params.studentId,
      token: `${req.params.studentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await setData(`portfolioShares/${share.id}`, share);
    res.status(201).json({ link: `/api/portfolio/shared/${share.token}`, token: share.token, expiresAt: share.expiresAt });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

export default router;
