import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// --- Student Custom Fields (Phase 1) ---
router.get('/custom-fields', async (_req, res) => {
  try {
    const fields = await listData('customFields');
    res.json(fields);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

router.post('/custom-fields', async (req, res) => {
  try {
    const field = { id: id('cf'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`customFields/${field.id}`, field);
    res.status(201).json(field);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create field' });
  }
});

router.put('/students/:id/custom-fields', async (req, res) => {
  try {
    await setData(`studentCustomFields/${req.params.id}`, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save custom fields' });
  }
});

router.get('/students/:id/custom-fields', async (req, res) => {
  try {
    const fields = await getData(`studentCustomFields/${req.params.id}`);
    res.json(fields || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// --- Student Transfers (Phase 1) ---
router.post('/students/:id/transfer', async (req, res) => {
  try {
    const { fromClass, toClass, reason, transferredBy } = req.body;
    const student = await getData(`users/${req.params.id}`);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const transfer = {
      id: id('tr'), studentId: req.params.id, studentName: student.name,
      fromClass, toClass, reason, transferredBy,
      transferredAt: new Date().toISOString(),
    };
    await setData(`studentTransfers/${transfer.id}`, transfer);
    await setData(`users/${req.params.id}/class`, toClass);
    res.status(201).json(transfer);
  } catch (e) {
    res.status(500).json({ error: 'Failed to transfer student' });
  }
});

router.get('/students/:id/transfers', async (req, res) => {
  try {
    const transfers = await listData('studentTransfers');
    res.json(transfers.filter((t: any) => t.studentId === req.params.id).sort((a: any, b: any) =>
      new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

router.get('/transfers', async (_req, res) => {
  try {
    const transfers = await listData('studentTransfers');
    res.json(transfers.sort((a: any, b: any) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// --- Family/Guardian Management (Phase 1) ---
router.post('/families', async (req, res) => {
  try {
    const family = { id: id('fam'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`families/${family.id}`, family);
    res.status(201).json(family);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create family' });
  }
});

router.get('/families', async (_req, res) => {
  try {
    const families = await listData('families');
    const { studentId } = _req.query;
    if (studentId) return res.json(families.filter((f: any) => f.students?.includes(studentId)));
    res.json(families);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

router.put('/families/:id', async (req, res) => {
  try {
    const existing = await getData(`families/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Family not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`families/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update family' });
  }
});

// --- Locker Management (Phase 1) ---
router.get('/lockers', async (_req, res) => {
  try {
    const lockers = await listData('lockers');
    const { available } = _req.query;
    if (available === 'true') return res.json(lockers.filter((l: any) => !l.assignedTo));
    res.json(lockers);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch lockers' });
  }
});

router.post('/lockers', async (req, res) => {
  try {
    const locker = { id: id('lk'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`lockers/${locker.id}`, locker);
    res.status(201).json(locker);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create locker' });
  }
});

router.post('/lockers/:id/assign', async (req, res) => {
  try {
    const { studentId } = req.body;
    const existing = await getData(`lockers/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Locker not found' });
    existing.assignedTo = studentId;
    existing.assignedAt = new Date().toISOString();
    await setData(`lockers/${req.params.id}`, existing);
    await setData(`users/${studentId}/lockerId`, req.params.id);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to assign locker' });
  }
});

// --- Student Notes (Phase 1) ---
router.post('/student-notes', async (req, res) => {
  try {
    const note = { id: id('sn'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`studentNotes/${note.id}`, note);
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.get('/student-notes/:studentId', async (req, res) => {
  try {
    const notes = await listData('studentNotes');
    res.json(notes.filter((n: any) => n.studentId === req.params.studentId).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// --- Graduation Tracking (Phase 1) ---
router.post('/graduation', async (req, res) => {
  try {
    const rec = { id: id('grad'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`graduation/${rec.id}`, rec);
    res.status(201).json(rec);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create graduation record' });
  }
});

router.get('/graduation/:studentId', async (req, res) => {
  try {
    const records = await listData('graduation');
    res.json(records.filter((r: any) => r.studentId === req.params.studentId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch graduation records' });
  }
});

// --- Promotions (Phase 1) ---
router.post('/promotions', async (req, res) => {
  try {
    const promo = { id: id('promo'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`promotions/${promo.id}`, promo);
    res.status(201).json(promo);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

router.put('/promotions/:id/execute', async (req, res) => {
  try {
    const existing = await getData(`promotions/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { approvedBy } = req.body;
    const students = await listData('users');
    for (const sId of existing.studentIds || []) {
      const student = students.find((s: any) => s.id === sId);
      if (student) await setData(`users/${sId}/class`, existing.toClass);
    }
    existing.status = 'executed';
    existing.approvedBy = approvedBy;
    existing.executedAt = new Date().toISOString();
    await setData(`promotions/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to execute promotion' });
  }
});

router.get('/promotions', async (_req, res) => {
  try {
    const promos = await listData('promotions');
    res.json(promos.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// --- Transfer Certificate (Phase 1) ---
router.post('/transfer-certificates', async (req, res) => {
  try {
    const tc = { id: id('tc'), ...req.body, issuedAt: new Date().toISOString(), certificateNo: `TC-${Date.now()}` };
    await setData(`transferCertificates/${tc.id}`, tc);
    res.status(201).json(tc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate TC' });
  }
});

router.get('/transfer-certificates/:studentId', async (req, res) => {
  try {
    const tcs = await listData('transferCertificates');
    res.json(tcs.filter((t: any) => t.studentId === req.params.studentId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch TCs' });
  }
});

export default router;
