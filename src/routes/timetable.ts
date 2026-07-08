import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, removeData } from '../firebase';

const router = Router();
const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_PERIODS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

async function isClassTeacher(teacherId: string, className: string): Promise<boolean> {
  try {
    const allClasses = await listData('classes');
    const cls = (allClasses || []).find((c: any) => c.name === className || c.id === className);
    return cls?.classTeacherId === teacherId;
  } catch {
    return false;
  }
}

async function canModifyTimetable(requesterId: string, className: string): Promise<boolean> {
  const requester = await getData(`users/${requesterId}`);
  if (!requester) return false;
  if (['admin', 'principal'].includes(requester?.role)) return true;
  if (requester?.role === 'teacher') {
    return isClassTeacher(requesterId, className);
  }
  return false;
}

function formatEntry(e: any) {
  return {
    id: e.id,
    class: e.class,
    day: e.day,
    time: e.time || (DEFAULT_PERIODS[e.period] != null ? DEFAULT_PERIODS[e.period] : String(e.period || '')),
    subject: e.subject || e.subjectName || e.subjectId || '',
    teacher: e.teacher || e.teacherName || '',
    room: e.room || '',
    color: e.color || '#f97316',
  };
}

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
    
    teacherTimetable.sort((a, b) => {
      const dayCompare = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
      if (dayCompare !== 0) return dayCompare;
      return (a.period || 0) - (b.period || 0);
    });

    const formattedTimetable: { [key: string]: any[] } = {};
    DAYS_ORDER.forEach(day => {
      formattedTimetable[day] = teacherTimetable.filter(e => e.day === day);
    });

    res.json({ success: true, teacherId, timetable: formattedTimetable });
  } catch (err) {
    console.error('[Timetable] Get teacher timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timetable/:className  — get timetable for a specific class (used by teachers & students)
router.get('/:className', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { className } = req.params;
    const all = await listData('timetable');
    const filtered = (all || []).filter(e => e.class === className);
    res.json(filtered.map(formatEntry));
  } catch (err) {
    console.error('[Timetable] Get class timetable error:', err);
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

    const { class: className, day, period, subjectId, teacherId, room, time, subject, teacher } = req.body;
    if (!className || !day) {
      return res.status(400).json({ error: 'Class name and day are required' });
    }

    if (!(await canModifyTimetable(requesterId, className))) {
      return res.status(403).json({ error: 'Forbidden - Only admins and class teachers can modify timetable' });
    }

    // Resolve period from time if not provided
    const resolvedPeriod = period != null ? period : DEFAULT_PERIODS.indexOf(time);
    if (resolvedPeriod < 0) {
      return res.status(400).json({ error: 'Invalid or missing period/time slot' });
    }

    // Resolve teacherId from teacher name if not provided
    let resolvedTeacherId = teacherId;
    let resolvedTeacherName = '';
    const users = await listData('users');
    if (!resolvedTeacherId && teacher) {
      const found = (users || []).find((u: any) => u.name === teacher);
      if (found) {
        resolvedTeacherId = found.id;
        resolvedTeacherName = found.name;
      }
    } else if (resolvedTeacherId) {
      const found = (users || []).find((u: any) => u.id === resolvedTeacherId);
      resolvedTeacherName = found?.name || 'Unknown';
    }
    if (!resolvedTeacherId) {
      return res.status(400).json({ error: 'Teacher is required' });
    }

    // Resolve subjectId from subject name if not provided
    let resolvedSubjectId = subjectId;
    let resolvedSubjectName = '';
    const allSubjects = await listData('subjects');
    if (!resolvedSubjectId && subject) {
      const found = (allSubjects || []).find((s: any) => s.name === subject);
      if (found) {
        resolvedSubjectId = found.id;
        resolvedSubjectName = found.name;
      }
    } else if (resolvedSubjectId) {
      const found = (allSubjects || []).find((s: any) => s.id === resolvedSubjectId);
      resolvedSubjectName = found?.name || resolvedSubjectId;
    }
    if (!resolvedSubjectId) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const resolvedTime = time || (DEFAULT_PERIODS[resolvedPeriod] != null ? DEFAULT_PERIODS[resolvedPeriod] : `Period ${resolvedPeriod + 1}`);

    // Check for time slot conflict
    const allTimetable = await listData('timetable');
    const conflict = (allTimetable || []).some((e: any) =>
      e.class === className && e.day === day && (e.period === resolvedPeriod || e.time === resolvedTime) && e.id !== 'placeholder'
    );
    if (conflict) {
      return res.status(409).json({ error: 'This time slot is already occupied' });
    }

    // Check for teacher conflict
    const teacherConflict = (allTimetable || []).some((e: any) =>
      e.teacherId === resolvedTeacherId && e.day === day && (e.period === resolvedPeriod || e.time === resolvedTime) && e.id !== 'placeholder'
    );
    if (teacherConflict) {
      return res.status(409).json({ error: 'Teacher is already assigned to another class at this time' });
    }

    const entryId = id('tt');
    const entry = {
      id: entryId,
      class: className,
      day,
      period: resolvedPeriod,
      time: resolvedTime,
      subjectId: resolvedSubjectId,
      subject: resolvedSubjectName,
      teacherId: resolvedTeacherId,
      teacher: resolvedTeacherName,
      teacherName: resolvedTeacherName,
      room: room || '',
      createdAt: new Date().toISOString(),
      createdBy: requesterId,
    };

    await setData(`timetable/${entryId}`, entry);
    res.json(formatEntry(entry));
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

    const { id } = req.params;
    const existing = await getData(`timetable/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    if (!(await canModifyTimetable(requesterId, existing.class))) {
      return res.status(403).json({ error: 'Forbidden - Only admins and class teachers can modify timetable' });
    }

    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString(), updatedBy: requesterId };
    await setData(`timetable/${id}`, updated);
    res.json({ success: true, entry: formatEntry(updated) });
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

    const { id } = req.params;
    const existing = await getData(`timetable/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    if (!(await canModifyTimetable(requesterId, existing.class))) {
      return res.status(403).json({ error: 'Forbidden - Only admins and class teachers can modify timetable' });
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