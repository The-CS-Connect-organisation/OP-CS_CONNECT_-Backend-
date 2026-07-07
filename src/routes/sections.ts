import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let sections = await listData('sections');
    // Support ?teacherId= filter
    const { teacherId } = req.query;
    if (teacherId && sections) {
      sections = sections.filter((s: any) => s.teacherId === teacherId);
    }
    res.json(sections || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// GET /sections/my/:teacherId — get section assigned to a teacher
router.get('/my/:teacherId', async (req, res) => {
  try {
    const sections = await listData('sections');
    const section = (sections || []).find((s: any) => s.teacherId === req.params.teacherId);
    if (!section) return res.status(404).json({ error: 'No section assigned' });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teacher section' });
  }
});

// GET /sections/:id/members — get student objects for section memberIds
router.get('/:id/members', async (req, res) => {
  try {
    const section = await getData(`sections/${req.params.id}`);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    const memberIds: string[] = (section as any).memberIds || [];
    if (memberIds.length === 0) return res.json([]);
    const usersData = await getData('users') as any;
    const members = memberIds.map((id: string) => usersData?.[id]).filter(Boolean);
    const safeMembers = members.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(safeMembers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch section members' });
  }
});

// POST /sections/:id/members — add a student to section memberIds
router.post('/:id/members', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    const section = await getData(`sections/${req.params.id}`);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    const memberIds: string[] = (section as any).memberIds || [];
    if (memberIds.includes(studentId)) return res.status(409).json({ error: 'Already a member' });
    memberIds.push(studentId);
    await setData(`sections/${req.params.id}`, { ...section, memberIds });
    res.json({ success: true, memberIds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /sections/:id/members/:studentId — remove a student from section memberIds
router.delete('/:id/members/:studentId', async (req, res) => {
  try {
    const section = await getData(`sections/${req.params.id}`);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    const memberIds: string[] = (section as any).memberIds || [];
    const filtered = memberIds.filter((id: string) => id !== req.params.studentId);
    await setData(`sections/${req.params.id}`, { ...section, memberIds: filtered });
    res.json({ success: true, memberIds: filtered });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.post('/', async (req, res) => {
  try {
    const newSec = { id: id('sec'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`sections/${newSec.id}`, newSec);
    res.status(201).json(newSec);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create section' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await getData(`sections/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body };
    await setData(`sections/${req.params.id}`, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update section' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await setData(`sections/${req.params.id}`, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

export default router;
