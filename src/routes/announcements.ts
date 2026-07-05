import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let items = await listData('announcements');
    const priority = req.query.priority as string;
    if (priority) {
      items = items.filter((a: any) => a.priority === priority);
    }

    items.sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const dateA = a.createdAt || a.date || 0;
      const dateB = b.createdAt || b.date || 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getData(`announcements/${req.params.id}`);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, priority, audience } = req.body;
    const uid = id('ann');
    const announcement = {
      id: uid, title: title || 'Untitled', content: content || '',
      priority: priority || 'normal', audience: audience || ['all'],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await setData(`announcements/${uid}`, announcement);
    res.status(201).json(announcement);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getData(`announcements/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`announcements/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await setData(`announcements/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
