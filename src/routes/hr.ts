import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Staff Directory (Phase 2) ---
router.get('/staff', async (req, res) => {
  try {
    const users = await listData('users') || [];
    const profiles = await listData('staffProfiles') || [];
    const { department, position } = req.query;
    let staff = [
      ...users.filter((u: any) => ['teacher', 'admin', 'coordinator', 'manager', 'driver', 'librarian'].includes(u.role)),
      ...profiles,
    ];
    const seen = new Set();
    staff = staff.filter((s: any) => {
      const key = s.id || s.employeeId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (department) staff = staff.filter((s: any) => s.department === department);
    if (position) staff = staff.filter((s: any) => s.position === position);
    res.json(staff);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const newStaff = { id: id('stf'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`staffProfiles/${newStaff.id}`, newStaff);
    res.status(201).json(newStaff);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create staff profile' });
  }
});

router.put('/staff/:id', async (req, res) => {
  try {
    const existing = await getData(`staffProfiles/${req.params.id}`) || await getData(`users/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Staff not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`staffProfiles/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update staff profile' });
  }
});

// --- Positions (Phase 2) ---
router.post('/positions', async (req, res) => {
  try {
    const pos = { id: id('pos'), ...req.body, status: 'active', createdAt: new Date().toISOString() };
    await setData(`positions/${pos.id}`, pos);
    res.status(201).json(pos);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create position' });
  }
});

router.get('/positions', async (req, res) => {
  try {
    let positions = await listData('positions');
    const { department, status } = req.query;
    if (department) positions = positions.filter((p: any) => p.department === department);
    if (status) positions = positions.filter((p: any) => p.status === status);
    res.json(positions);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// --- Staff Leave Management (Phase 1/2) ---
router.post('/leave', async (req, res) => {
  try {
    const leave = { id: id('sl'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    // Validate leave balance
    const balances = await getData(`leaveBalances/${req.body.userId}`);
    const typeBalance = (balances || {})[req.body.type || 'annual'] || 0;
    const daysRequested = req.body.days || 1;
    if (daysRequested > typeBalance) return res.status(400).json({ error: 'Insufficient leave balance' });
    await setData(`staffLeaves/${leave.id}`, leave);
    res.status(201).json(leave);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit leave' });
  }
});

router.get('/leave', async (req, res) => {
  try {
    let leaves = await listData('staffLeaves');
    const { userId, status, type } = req.query;
    if (userId) leaves = leaves.filter((l: any) => l.userId === userId);
    if (status) leaves = leaves.filter((l: any) => l.status === status);
    if (type) leaves = leaves.filter((l: any) => l.type === type);
    res.json(leaves.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
});

router.put('/leave/:id/approve', async (req, res) => {
  try {
    const leave = await getData(`staffLeaves/${req.params.id}`);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    leave.status = 'approved';
    leave.approvedBy = req.body.approvedBy;
    leave.approvedAt = new Date().toISOString();
    await setData(`staffLeaves/${req.params.id}`, leave);
    // Deduct balance
    const balances = await getData(`leaveBalances/${leave.userId}`) || {};
    balances[leave.type || 'annual'] = (balances[leave.type || 'annual'] || 0) - (leave.days || 1);
    await setData(`leaveBalances/${leave.userId}`, balances);
    res.json(leave);
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve leave' });
  }
});

router.put('/leave/:id/reject', async (req, res) => {
  try {
    const leave = await getData(`staffLeaves/${req.params.id}`);
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    leave.status = 'rejected';
    leave.rejectionReason = req.body.reason;
    leave.rejectedAt = new Date().toISOString();
    await setData(`staffLeaves/${req.params.id}`, leave);
    res.json(leave);
  } catch (e) {
    res.status(500).json({ error: 'Failed to reject leave' });
  }
});

router.post('/leave/balances', async (req, res) => {
  try {
    const { userId, balances } = req.body;
    await setData(`leaveBalances/${userId}`, balances);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to set balances' });
  }
});

router.get('/leave/balances/:userId', async (req, res) => {
  try {
    const balances = await getData(`leaveBalances/${req.params.userId}`);
    res.json(balances || { annual: 20, sick: 12, personal: 5, other: 0 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// --- Certifications (Phase 2) ---
router.post('/certifications', async (req, res) => {
  try {
    const cert = { id: id('cert'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`certifications/${cert.id}`, cert);
    res.status(201).json(cert);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add certification' });
  }
});

router.get('/certifications', async (req, res) => {
  try {
    let certs = await listData('certifications');
    const { userId, status } = req.query;
    if (userId) certs = certs.filter((c: any) => c.userId === userId);
    if (status) certs = certs.filter((c: any) => c.status === status);
    // Check expiries
    const now = new Date();
    certs = certs.map((c: any) => ({
      ...c,
      isExpired: c.expiryDate ? new Date(c.expiryDate) < now : false,
      expiringSoon: c.expiryDate ? (new Date(c.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30 : false,
    }));
    res.json(certs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

// --- Training (Phase 2) ---
router.post('/training', async (req, res) => {
  try {
    const training = { id: id('trn'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`training/${training.id}`, training);
    res.status(201).json(training);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create training record' });
  }
});

router.get('/training', async (req, res) => {
  try {
    let training = await listData('training');
    const { userId, type } = req.query;
    if (userId) training = training.filter((t: any) => t.userId === userId);
    if (type) training = training.filter((t: any) => t.type === type);
    res.json(training);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch training records' });
  }
});

// --- Appraisals (Phase 2) ---
router.post('/appraisals', async (req, res) => {
  try {
    const appraisal = { id: id('appr'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`appraisals/${appraisal.id}`, appraisal);
    res.status(201).json(appraisal);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create appraisal' });
  }
});

router.get('/appraisals', async (req, res) => {
  try {
    let appraisals = await listData('appraisals');
    const { userId, reviewerId, status } = req.query;
    if (userId) appraisals = appraisals.filter((a: any) => a.userId === userId);
    if (reviewerId) appraisals = appraisals.filter((a: any) => a.reviewerId === reviewerId);
    if (status) appraisals = appraisals.filter((a: any) => a.status === status);
    res.json(appraisals);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appraisals' });
  }
});

router.put('/appraisals/:id/submit', async (req, res) => {
  try {
    const existing = await getData(`appraisals/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    existing.status = 'completed';
    existing.ratings = req.body.ratings;
    existing.feedback = req.body.feedback;
    existing.submittedAt = new Date().toISOString();
    await setData(`appraisals/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit appraisal' });
  }
});

// --- Recruitment (Phase 2) ---
router.post('/recruitment/jobs', async (req, res) => {
  try {
    const job = { id: id('job'), ...req.body, status: 'open', createdAt: new Date().toISOString() };
    await setData(`recruitmentJobs/${job.id}`, job);
    res.status(201).json(job);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create job posting' });
  }
});

router.get('/recruitment/jobs', async (req, res) => {
  try {
    let jobs = await listData('recruitmentJobs');
    const { department, status } = req.query;
    if (department) jobs = jobs.filter((j: any) => j.department === department);
    if (status) jobs = jobs.filter((j: any) => j.status === status);
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.post('/recruitment/applications', async (req, res) => {
  try {
    const app = { id: id('rapp'), ...req.body, status: 'received', createdAt: new Date().toISOString() };
    await setData(`recruitmentApplications/${app.id}`, app);
    res.status(201).json(app);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

router.get('/recruitment/applications', async (req, res) => {
  try {
    let apps = await listData('recruitmentApplications');
    const { jobId, status } = req.query;
    if (jobId) apps = apps.filter((a: any) => a.jobId === jobId);
    if (status) apps = apps.filter((a: any) => a.status === status);
    res.json(apps);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.put('/recruitment/applications/:id/status', async (req, res) => {
  try {
    const app = await getData(`recruitmentApplications/${req.params.id}`);
    if (!app) return res.status(404).json({ error: 'Not found' });
    app.status = req.body.status;
    app.updatedAt = new Date().toISOString();
    if (req.body.status === 'interviewed') app.interviewedAt = new Date().toISOString();
    if (req.body.status === 'offered') app.offeredAt = new Date().toISOString();
    if (req.body.status === 'hired') app.hiredAt = new Date().toISOString();
    await setData(`recruitmentApplications/${req.params.id}`, app);
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// --- Onboarding (Phase 2) ---
router.post('/onboarding/tasks', async (req, res) => {
  try {
    const task = { id: id('obt'), ...req.body, completed: false, createdAt: new Date().toISOString() };
    await setData(`onboardingTasks/${task.id}`, task);
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create onboarding task' });
  }
});

router.get('/onboarding/tasks', async (req, res) => {
  try {
    let tasks = await listData('onboardingTasks');
    const { userId, department } = req.query;
    if (userId) tasks = tasks.filter((t: any) => t.userId === userId);
    if (department) tasks = tasks.filter((t: any) => t.department === department);
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.put('/onboarding/tasks/:id/complete', async (req, res) => {
  try {
    const task = await getData(`onboardingTasks/${req.params.id}`);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.completed = true;
    task.completedAt = new Date().toISOString();
    await setData(`onboardingTasks/${req.params.id}`, task);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// --- Payroll (Phase 2) ---
router.post('/payroll/salary-scales', async (req, res) => {
  try {
    const scale = { id: id('psc'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`salaryScales/${scale.id}`, scale);
    res.status(201).json(scale);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create salary scale' });
  }
});

router.get('/payroll/salary-scales', async (_req, res) => {
  try {
    const scales = await listData('salaryScales');
    res.json(scales);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch salary scales' });
  }
});

router.post('/payroll/run', async (req, res) => {
  try {
    const { period, month, year, processedBy } = req.body;
    const staff = await listData('users');
    const employees = staff.filter((u: any) => ['teacher', 'admin', 'coordinator', 'manager', 'librarian'].includes(u.role));
    const scales = await listData('salaryScales');
    const payslips: any[] = [];
    for (const emp of employees) {
      const scale = scales.find((s: any) => s.position === emp.position || s.role === emp.role);
      const baseSalary = scale?.baseSalary || 0;
      const allowances = scale?.allowances || 0;
      const deductions = scale?.deductions || 0;
      const netSalary = baseSalary + allowances - deductions;
      const payslip = {
        id: id('ps'), userId: emp.id, name: emp.name, position: emp.position || emp.role,
        period, month, year, baseSalary, allowances, deductions, netSalary,
        status: 'draft', processedBy, processedAt: new Date().toISOString(),
      };
      await setData(`payslips/${payslip.id}`, payslip);
      payslips.push(payslip);
    }
    res.json({ success: true, count: payslips.length, period, payslips });
  } catch (e) {
    res.status(500).json({ error: 'Failed to run payroll' });
  }
});

router.get('/payroll/payslips', async (req, res) => {
  try {
    let payslips = await listData('payslips');
    const { userId, period, status } = req.query;
    if (userId) payslips = payslips.filter((p: any) => p.userId === userId);
    if (period) payslips = payslips.filter((p: any) => p.period === period);
    if (status) payslips = payslips.filter((p: any) => p.status === status);
    res.json(payslips.sort((a: any, b: any) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});

router.put('/payroll/payslips/:id/approve', async (req, res) => {
  try {
    const slip = await getData(`payslips/${req.params.id}`);
    if (!slip) return res.status(404).json({ error: 'Payslip not found' });
    slip.status = 'approved';
    slip.approvedBy = req.body.approvedBy;
    slip.approvedAt = new Date().toISOString();
    await setData(`payslips/${req.params.id}`, slip);
    res.json(slip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve payslip' });
  }
});

export default router;
