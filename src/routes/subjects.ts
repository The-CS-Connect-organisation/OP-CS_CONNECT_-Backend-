import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const subjects = await listData('subjects');
    res.json(subjects || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const newSub = { id: id('sub'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`subjects/${newSub.id}`, newSub);
    res.status(201).json(newSub);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await getData(`subjects/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body };
    await setData(`subjects/${req.params.id}`, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await setData(`subjects/${req.params.id}`, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

export default router;
