import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const items = await listData('circulars');
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch circulars' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getData(`circulars/${req.params.id}`);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch circular' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, type, priority, audience, status } = req.body;
    const uid = id('cir');
    const circular = {
      id: uid, title: title || 'Untitled', content: content || '',
      type: type || 'circular', priority: priority || 'medium',
      audience: audience || ['all'], status: status || 'published',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await setData(`circulars/${uid}`, circular);
    res.status(201).json(circular);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create circular' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getData(`circulars/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`circulars/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update circular' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await setData(`circulars/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete circular' });
  }
});

export default router;
