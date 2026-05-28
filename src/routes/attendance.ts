import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Period Attendance (Phase 1) ---
router.post('/period/mark', async (req, res) => {
  try {
    const { class: className, date, period, subjectId, entries } = req.body;
    if (!className || !date || !period || !entries) return res.status(400).json({ error: 'Missing fields' });
    for (const e of entries) {
      await setData(`periodAttendance/${className}/${date}/${period}/${e.studentId}`, {
        studentId: e.studentId, status: e.status, subjectId, markedAt: new Date().toISOString(),
      });
    }
    const users = await listData('users');
    const students = users.filter((u: any) => u.role === 'student' && u.class === className);
    const total = students.length;
    const present = entries.filter((e: any) => e.status === 'present').length;
    const absent = total - present;
    // Update daily summary
    await setData(`attendanceSummary/${className}/${date}`, {
      date, class: className, total, present, absent, periodCount: period,
    });
    res.json({ success: true, total, present, absent, date, period });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark period attendance' });
  }
});

router.get('/period/:class/:date', async (req, res) => {
  try {
    const { class: className, date } = req.params;
    const data = await getData(`periodAttendance/${className}/${date}`);
    if (!data) return res.json([]);
    const result: any[] = [];
    for (const [period, students] of Object.entries(data)) {
      for (const [studentId, record] of Object.entries(students as any)) {
        result.push({ period, studentId, ...(record as any) });
      }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch period attendance' });
  }
});

router.get('/period/:class/:date/:period', async (req, res) => {
  try {
    const records = await getData(`periodAttendance/${req.params.class}/${req.params.date}/${req.params.period}`);
    res.json(records ? Object.values(records) : []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch period records' });
  }
});

// --- Attendance Policies (Phase 1) ---
router.get('/policies', async (_req, res) => {
  try {
    const policies = await listData('attendancePolicies');
    res.json(policies);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

router.post('/policies', async (req, res) => {
  try {
    const policy = { id: id('ap'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`attendancePolicies/${policy.id}`, policy);
    res.status(201).json(policy);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

router.put('/policies/:id', async (req, res) => {
  try {
    const existing = await getData(`attendancePolicies/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Policy not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`attendancePolicies/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// --- Teacher Attendance (Phase 1) ---
router.post('/teacher/mark', async (req, res) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries) return res.status(400).json({ error: 'Missing fields' });
    for (const e of entries) {
      await setData(`teacherAttendance/${date}/${e.teacherId}`, {
        teacherId: e.teacherId, status: e.status, remarks: e.remarks || '', markedAt: new Date().toISOString(),
      });
    }
    res.json({ success: true, count: entries.length, date });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark teacher attendance' });
  }
});

router.get('/teacher/:date', async (req, res) => {
  try {
    const records = await getData(`teacherAttendance/${req.params.date}`);
    res.json(records ? Object.values(records) : []);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch teacher attendance' });
  }
});

router.get('/teacher/summary/:teacherId', async (req, res) => {
  try {
    const allData = await getData('teacherAttendance');
    if (!allData) return res.json([]);
    const result: any[] = [];
    for (const [date, records] of Object.entries(allData)) {
      for (const [tid, rec] of Object.entries(records as any)) {
        if (tid === req.params.teacherId) result.push({ date, ...(rec as any) });
      }
    }
    res.json(result.sort((a, b) => b.date.localeCompare(a.date)));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// --- Attendance Reports (Phase 1) ---
router.get('/reports/:class', async (req, res) => {
  try {
    const className = req.params.class;
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const summary = await getData(`attendanceSummary/${className}`);
    if (!summary) return res.json({ month, totalDays: 0, records: [] });
    const records = Object.entries(summary)
      .filter(([date]) => date.startsWith(month))
      .map(([date, data]) => ({ date, ...(data as any) }));
    const totalDays = records.length;
    const totalPresent = records.reduce((s: number, r: any) => s + (r.present || 0), 0);
    const totalAbsent = records.reduce((s: number, r: any) => s + (r.absent || 0), 0);
    res.json({ month, totalDays, totalPresent, totalAbsent, records });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// --- Absence Requests (Phase 1 - enhanced) ---
router.post('/absence-requests', async (req, res) => {
  try {
    const reqData = await listData('absenceRequests');
    const newReq = { id: id('ar'), ...req.body, status: 'pending', requestedAt: new Date().toISOString() };
    await setData(`absenceRequests/${newReq.id}`, newReq);
    res.status(201).json(newReq);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create absence request' });
  }
});

router.get('/absence-requests', async (_req, res) => {
  try {
    const requests = await listData('absenceRequests');
    res.json(requests.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.put('/absence-requests/:id/:action', async (req, res) => {
  try {
    const existing = await getData(`absenceRequests/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    existing.status = req.params.action === 'approve' ? 'approved' : 'rejected';
    existing.reviewedAt = new Date().toISOString();
    existing.reviewedBy = req.body.reviewedBy;
    await setData(`absenceRequests/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

export default router;
