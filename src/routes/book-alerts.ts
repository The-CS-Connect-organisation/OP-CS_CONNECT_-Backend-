import { Router } from 'express';
import { getData, setData } from '../firebase';

const router = Router();

// GET /api/book-alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await getData('bookAlerts');
    const { class: className } = req.query;
    let result = alerts ? Object.values(alerts) : [];
    if (className) result = result.filter((a: any) => a.class === className);
    res.json(result);
  } catch (error) {
    console.error('[Book Alerts] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch book alerts' });
  }
});

// POST /api/book-alerts
router.post('/', async (req, res) => {
  try {
    const alert = { id: `ba${Date.now()}`, ...req.body };
    await setData(`bookAlerts/${alert.id}`, alert);
    res.status(201).json(alert);
  } catch (error) {
    console.error('[Book Alerts] Create error:', error);
    res.status(500).json({ error: 'Failed to create book alert' });
  }
});

export default router;
