import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, removeData } from '../firebase';

const router = Router();

// GET /api/timetable/teacher/:teacherId
router.get('/teacher/:teacherId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { teacherId } = req.params;
    if (requesterId !== teacherId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your own timetable' });
      }
    }

    const timetable = await listData('timetable');
    const teacherTimetable = timetable.filter(e => e.teacherId === teacherId);
    
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    teacherTimetable.sort((a, b) => {
      const dayCompare = daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
      if (dayCompare !== 0) return dayCompare;
      return a.period - b.period;
    });

    const formattedTimetable: { [key: string]: any[] } = {};
    daysOrder.forEach(day => {
      formattedTimetable[day] = teacherTimetable.filter(e => e.day === day);
    });

    res.json({ success: true, teacherId, timetable: formattedTimetable });
  } catch (err) {
    console.error('[Timetable] Get teacher timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/timetable
router.post('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Only admins can modify timetable' });
    }

    const { class: className, day, period, subjectId, teacherId, room } = req.body;
    if (!className || !day || !period || !subjectId || !teacherId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const allTimetable = await listData('timetable');
    const conflict = allTimetable.some(e => 
      e.class === className && e.day === day && e.period === period && e.id !== 'placeholder'
    );
    if (conflict) {
      return res.status(409).json({ error: 'This time slot is already occupied' });
    }

    const teacherConflict = allTimetable.some(e =>
      e.teacherId === teacherId && e.day === day && e.period === period && e.id !== 'placeholder'
    );
    if (teacherConflict) {
      return res.status(409).json({ error: 'Teacher is already assigned to another class at this time' });
    }

    const teacher = await getData(`users/${teacherId}`);
    const entryId = id('tt');
    const entry = {
      id: entryId,
      class: className,
      day,
      period,
      subjectId,
      teacherId,
      teacherName: teacher?.name || 'Unknown',
      room: room || '',
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`timetable/${entryId}`, entry);
    res.json({ success: true, entry });
  } catch (err) {
    console.error('[Timetable] Create entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/timetable/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Only admins can modify timetable' });
    }

    const { id } = req.params;
    const existing = await getData(`timetable/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString(), updatedBy: requesterId };
    await setData(`timetable/${id}`, updated);
    res.json({ success: true, entry: updated });
  } catch (err) {
    console.error('[Timetable] Update entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/timetable/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Only admins can modify timetable' });
    }

    const { id } = req.params;
    const existing = await getData(`timetable/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    await removeData(`timetable/${id}`);
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (err) {
    console.error('[Timetable] Delete entry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timetable
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const timetable = await listData('timetable');
    res.json({ success: true, totalEntries: timetable.length, entries: timetable });
  } catch (err) {
    console.error('[Timetable] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;