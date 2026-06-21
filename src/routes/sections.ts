import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sections = await listData('sections');
    res.json(sections || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sections' });
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
