import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Timetable Generator (Phase 1) ---
router.post('/timetable/generate', async (req, res) => {
  try {
    const { class: className, constraints } = req.body;
    if (!className) return res.status(400).json({ error: 'className required' });
    const subjects = await listData('subjects');
    const teachers = await listData('users');
    const classSubjects = subjects.filter((s: any) => s.classes?.includes(className));
    const classTeachers = teachers.filter((t: any) => t.role === 'teacher' && t.classes?.includes(className));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodsPerDay = constraints?.periodsPerDay || 6;
    const periodDuration = constraints?.periodDuration || 45;
    const startTime = constraints?.startTime || '8:00';
    const timetable: any[] = [];

    // Parse start time to minutes
    const [sh, sm] = startTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;

    for (const day of days) {
      const periods: any[] = [];
      let assignedSubjects = [...classSubjects];
      const usedTeachers: Set<string> = new Set();
      for (let p = 0; p < periodsPerDay; p++) {
        // Round-robin subject assignment
        const subjIdx = p % assignedSubjects.length;
        const subject = assignedSubjects[subjIdx];
        // Find teacher for this subject
        const teacher = classTeachers.find((t: any) =>
          t.subjects?.includes(subject.name) && !usedTeachers.has(t.id)
        ) || classTeachers.find((t: any) => t.subjects?.includes(subject.name));
        if (teacher) usedTeachers.add(teacher.id);
        const periodStart = startMinutes + p * periodDuration;
        const periodEnd = periodStart + periodDuration;
        const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        periods.push({
          period: p + 1, time: `${fmt(periodStart)}-${fmt(periodEnd)}`,
          subject: subject?.name || 'Free', subjectId: subject?.id || '',
          teacher: teacher?.name || '', teacherId: teacher?.id || '',
        });
      }
      timetable.push({ day, periods });
    }
    await setData(`timetable/${className}`, timetable);
    res.json({ success: true, class: className, timetable });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate timetable' });
  }
});

router.get('/timetable/:class', async (req, res) => {
  try {
    const tt = await getData(`timetable/${req.params.class}`);
    res.json(tt || []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// --- Room Booking (Phase 1) ---
router.get('/rooms', async (req, res) => {
  try {
    // If query param for room listing, return rooms; otherwise return bookings
    if (req.query.list === 'true') {
      const rooms = await listData('rooms');
      return res.json(rooms);
    }
    // Default: return room bookings (used by AdminScheduling.getRoomBookings)
    const data = await getData('roomBookings');
    res.json(data ? Object.values(data).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) : []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch room bookings' });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    // Frontend AdminScheduling calls this to CREATE a booking (not a physical room)
    const { roomId, date, startTime, endTime, bookedBy, purpose } = req.body;
    const bookings = await listData('roomBookings');
    const conflict = bookings.find((b: any) =>
      b.roomId === roomId && b.date === date && b.status !== 'cancelled' &&
      ((startTime >= b.startTime && startTime < b.endTime) ||
       (endTime > b.startTime && endTime <= b.endTime) ||
       (startTime <= b.startTime && endTime >= b.endTime))
    );
    if (conflict) return res.status(409).json({ error: 'Room already booked for this time', conflict });
    const booking = {
      id: id('bk'), roomId, date, startTime, endTime, bookedBy, purpose,
      status: 'approved', createdAt: new Date().toISOString(),
    };
    await setData(`roomBookings/${booking.id}`, booking);
    res.status(201).json(booking);
  } catch (e) {
    res.status(500).json({ error: 'Failed to book room' });
  }
});

router.get('/rooms/available', async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query;
    const rooms = await listData('rooms');
    const bookings = date ? await listData('roomBookings') : [];
    const bookedRoomIds = new Set(
      bookings
        .filter((b: any) => b.date === date && b.status === 'approved')
        .map((b: any) => b.roomId)
    );
    const available = rooms.filter((r: any) => !bookedRoomIds.has(r.id));
    res.json(available);
  } catch (e) {
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

router.post('/rooms/book', async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, bookedBy, purpose } = req.body;
    // Conflict check
    const bookings = await listData('roomBookings');
    const conflict = bookings.find((b: any) =>
      b.roomId === roomId && b.date === date && b.status !== 'cancelled' &&
      ((startTime >= b.startTime && startTime < b.endTime) ||
       (endTime > b.startTime && endTime <= b.endTime) ||
       (startTime <= b.startTime && endTime >= b.endTime))
    );
    if (conflict) return res.status(409).json({ error: 'Room already booked for this time', conflict });
    const booking = {
      id: id('bk'), roomId, date, startTime, endTime, bookedBy, purpose,
      status: 'approved', createdAt: new Date().toISOString(),
    };
    await setData(`roomBookings/${booking.id}`, booking);
    res.status(201).json(booking);
  } catch (e) {
    res.status(500).json({ error: 'Failed to book room' });
  }
});

router.put('/rooms/bookings/:id/cancel', async (req, res) => {
  try {
    const existing = await getData(`roomBookings/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    existing.status = 'cancelled';
    existing.cancelledAt = new Date().toISOString();
    await setData(`roomBookings/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// --- Bell Schedules (Phase 1) ---
router.get('/bell-schedules', async (_req, res) => {
  try {
    const schedules = await listData('bellSchedules');
    res.json(schedules);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bell schedules' });
  }
});

router.post('/bell-schedules', async (req, res) => {
  try {
    const schedule = { id: id('bs'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`bellSchedules/${schedule.id}`, schedule);
    res.status(201).json(schedule);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create bell schedule' });
  }
});

// --- Coverage (Phase 1) ---
router.post('/coverages', async (req, res) => {
  try {
    const coverage = { id: id('cov'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`coverages/${coverage.id}`, coverage);
    res.status(201).json(coverage);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create coverage' });
  }
});

router.get('/coverages', async (_req, res) => {
  try {
    const coverages = await listData('coverages');
    res.json(coverages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch coverages' });
  }
});

router.put('/coverages/:id/approve', async (req, res) => {
  try {
    const existing = await getData(`coverages/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    existing.status = 'approved';
    existing.approvedBy = req.body.approvedBy;
    existing.approvedAt = new Date().toISOString();
    await setData(`coverages/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve coverage' });
  }
});

// --- Subject Choice (Phase 1) ---
router.post('/subject-choices', async (req, res) => {
  try {
    const choice = { id: id('sc'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`subjectChoices/${choice.id}`, choice);
    res.status(201).json(choice);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit subject choice' });
  }
});

router.get('/subject-choices', async (req, res) => {
  try {
    const choices = await listData('subjectChoices');
    const { class: className, studentId, status } = req.query;
    let filtered = choices;
    if (className) filtered = filtered.filter((c: any) => c.class === className);
    if (studentId) filtered = filtered.filter((c: any) => c.studentId === studentId);
    if (status) filtered = filtered.filter((c: any) => c.status === status);
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch choices' });
  }
});

// Frontend calls GET /subject-choices/all to get all subject choices
router.get('/subject-choices/:studentId', async (req, res) => {
  try {
    const choices = await listData('subjectChoices');
    if (req.params.studentId && req.params.studentId !== 'all') {
      res.json(choices.filter((c: any) => c.studentId === req.params.studentId));
    } else {
      res.json(choices);
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch choices' });
  }
});

router.put('/subject-choices/:id/:action', async (req, res) => {
  try {
    const existing = await getData(`subjectChoices/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    existing.status = req.params.action === 'approve' ? 'approved' : 'rejected';
    existing.reviewedAt = new Date().toISOString();
    existing.reviewedBy = req.body.reviewedBy;
    await setData(`subjectChoices/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update choice' });
  }
});

// --- Co-teaching (Phase 1) ---
router.post('/co-teaching', async (req, res) => {
  try {
    const ct = { id: id('ct'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`coTeaching/${ct.id}`, ct);
    res.status(201).json(ct);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create co-teaching' });
  }
});

router.get('/co-teaching', async (_req, res) => {
  try {
    const records = await listData('coTeaching');
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch co-teaching' });
  }
});

router.get('/co-teaching/:class', async (req, res) => {
  try {
    const records = await listData('coTeaching');
    res.json(records.filter((r: any) => r.class === req.params.class));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch co-teaching' });
  }
});

// --- Pull-out Services (Phase 1) ---
router.post('/pull-out-services', async (req, res) => {
  try {
    const svc = { id: id('pos'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`pullOutServices/${svc.id}`, svc);
    res.status(201).json(svc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.get('/pull-out-services', async (req, res) => {
  try {
    const services = await listData('pullOutServices');
    if (req.query.studentId) return res.json(services.filter((s: any) => s.studentId === req.query.studentId));
    res.json(services);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// --- Rotation Generation (Phase 1) ---
router.post('/rotations/generate', async (req, res) => {
  try {
    const { class: className, groups, weeks } = req.body;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const rotation: any[] = [];
    for (let w = 1; w <= (weeks || 4); w++) {
      const weekRotation: any = { week: w, days: {} };
      for (const day of days) {
        const groupRotation = groups?.map((_: any, i: number) => groups[(i + (w - 1) * days.indexOf(day)) % groups.length]);
        weekRotation.days[day] = { groups: groupRotation };
      }
      rotation.push(weekRotation);
    }
    await setData(`rotations/${className}`, rotation);
    res.json({ success: true, class: className, rotation });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate rotations' });
  }
});

router.put('/rotations/save', async (req, res) => {
  try {
    const { class: className, rotation } = req.body;
    await setData(`rotations/${className}`, rotation);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save rotation' });
  }
});

router.get('/rotations/:class', async (req, res) => {
  try {
    const rotation = await getData(`rotations/${req.params.class}`);
    res.json(rotation || []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rotations' });
  }
});

// --- Frontend-compatible aliases ---

// GET /scheduling/rooms/list → rooms list (alias for /rooms?list=true)
router.get('/rooms/list', async (_req, res) => {
  try {
    const rooms = await listData('rooms');
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// PUT /scheduling/rooms/:id — update room booking
router.put('/rooms/:id', async (req, res) => {
  try {
    const existing = await getData(`roomBookings/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`roomBookings/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /scheduling/rooms/:id — cancel room booking
router.delete('/rooms/:id', async (req, res) => {
  try {
    const existing = await getData(`roomBookings/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    existing.status = 'cancelled';
    existing.cancelledAt = new Date().toISOString();
    await setData(`roomBookings/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// GET /scheduling/coverage — alias for /coverages
router.get('/coverage', async (_req, res) => {
  try {
    const coverages = await listData('coverages');
    res.json(coverages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch coverages' });
  }
});

// POST /scheduling/coverage — alias for /coverages
router.post('/coverage', async (req, res) => {
  try {
    const coverage = { id: id('cov'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`coverages/${coverage.id}`, coverage);
    res.status(201).json(coverage);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create coverage' });
  }
});

// PUT /scheduling/coverage/:id — update coverage request
router.put('/coverage/:id', async (req, res) => {
  try {
    const existing = await getData(`coverages/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Coverage not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`coverages/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update coverage' });
  }
});

// PUT /scheduling/bell-schedules/:id
router.put('/bell-schedules/:id', async (req, res) => {
  try {
    const existing = await getData(`bellSchedules/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Bell schedule not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`bellSchedules/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update bell schedule' });
  }
});

// DELETE /scheduling/bell-schedules/:id
router.delete('/bell-schedules/:id', async (req, res) => {
  try {
    const existing = await getData(`bellSchedules/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Bell schedule not found' });
    await setData(`bellSchedules/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete bell schedule' });
  }
});

// PUT /scheduling/timetable/:class/:day/:periodIdx — update single timetable cell
router.put('/timetable/:class/:day/:periodIdx', async (req, res) => {
  try {
    const tt = await getData(`timetable/${req.params.class}`) || [];
    const dayIdx = (tt as any[]).findIndex((d: any) => d.day === req.params.day);
    if (dayIdx === -1) return res.status(404).json({ error: 'Day not found' });
    const periodIdx = parseInt(req.params.periodIdx);
    (tt as any[])[dayIdx].periods[periodIdx] = { ...(tt as any[])[dayIdx].periods[periodIdx], ...req.body };
    await setData(`timetable/${req.params.class}`, tt);
    res.json(tt);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update timetable entry' });
  }
});

export default router;
