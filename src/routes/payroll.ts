import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getData, setData, listData } from '../firebase';

const router = Router();

// GET /api/payroll - Get all payroll records (with optional month filter)
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { month } = req.query;
    const allPayroll = await listData('payrollRecords');
    
    let filtered = allPayroll;
    if (month) {
      filtered = allPayroll.filter(p => p.month === month);
    }

    const summary = {
      totalGross: filtered.reduce((sum: number, p: any) => sum + p.grossSalary, 0),
      totalNet: filtered.reduce((sum: number, p: any) => sum + p.netSalary, 0),
      totalDeductions: filtered.reduce((sum: number, p: any) => sum + p.totalDeductions, 0),
      pending: filtered.filter(p => p.status === 'pending').length,
      processed: filtered.filter(p => p.status === 'processed').length,
      paid: filtered.filter(p => p.status === 'paid').length,
      total: filtered.length
    };

    res.json({
      success: true,
      payrollRecords: filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      summary
    });
  } catch (err) {
    console.error('[Payroll] Get all payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payroll/teacher/:teacherId - Get payroll for specific teacher
router.get('/teacher/:teacherId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { teacherId } = req.params;
    if (requesterId !== teacherId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your own payroll' });
      }
    }

    const teacher = await getData(`users/${teacherId}`);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const allPayroll = await listData('payrollRecords');
    const teacherPayroll = allPayroll.filter(p => p.teacherId === teacherId);

    res.json({
      success: true,
      teacher: { id: teacherId, name: teacher.name, department: teacher.department },
      payrollHistory: teacherPayroll.sort((a, b) => b.month.localeCompare(a.month))
    });
  } catch (err) {
    console.error('[Payroll] Get teacher payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payroll/create - Create new payroll record
router.post('/create', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { teacherId, month, grossSalary, deductions = [], allowances = [], notes = '' } = req.body;
    if (!teacherId || !month || !grossSalary) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const teacher = await getData(`users/${teacherId}`);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Check if payroll already exists for this teacher and month
    const existingPayroll = await listData('payrollRecords');
    const duplicate = existingPayroll.find(p => p.teacherId === teacherId && p.month === month);
    if (duplicate) {
      return res.status(409).json({ error: 'Payroll record already exists for this teacher and month' });
    }

    const totalDeductions = deductions.reduce((sum: number, d: any) => sum + d.amount, 0);
    const totalAllowances = allowances.reduce((sum: number, a: any) => sum + a.amount, 0);
    const netSalary = grossSalary + totalAllowances - totalDeductions;

    const payrollId = uuidv4();
    const payrollRecord = {
      id: payrollId,
      teacherId,
      teacherName: teacher.name,
      month,
      grossSalary,
      totalAllowances,
      allowances,
      totalDeductions,
      deductions,
      netSalary,
      status: 'pending',
      notes,
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`payrollRecords/${payrollId}`, payrollRecord);

    // Send notification to teacher
    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [teacherId],
          title: 'New Payroll Created',
          message: `Your payroll for ${month} has been created. Net salary: ₹${netSalary}`,
          type: 'payroll',
          link: '/payroll'
        })
      });
    } catch (notifyErr) {
      console.warn('[Payroll] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, payrollRecord });
  } catch (err) {
    console.error('[Payroll] Create payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/payroll/:id/process - Mark payroll as processed
router.put('/:id/process', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const payroll = await getData(`payrollRecords/${id}`);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (payroll.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payroll can be processed' });
    }

    const updatedPayroll = { ...payroll, status: 'processed', processedAt: new Date().toISOString(), processedBy: requesterId };
    await setData(`payrollRecords/${id}`, updatedPayroll);

    // Send notification
    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [payroll.teacherId],
          title: 'Payroll Processed',
          message: `Your payroll for ${payroll.month} has been processed. Net salary: ₹${payroll.netSalary}`,
          type: 'payroll',
          link: '/payroll'
        })
      });
    } catch (notifyErr) {
      console.warn('[Payroll] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, payrollRecord: updatedPayroll });
  } catch (err) {
    console.error('[Payroll] Process payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/payroll/:id/pay - Mark payroll as paid
router.put('/:id/pay', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const payroll = await getData(`payrollRecords/${id}`);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (payroll.status !== 'processed') {
      return res.status(400).json({ error: 'Only processed payroll can be marked as paid' });
    }

    const { transactionId = '', paymentMethod = 'bank_transfer' } = req.body;
    const updatedPayroll = { 
      ...payroll, 
      status: 'paid', 
      paidAt: new Date().toISOString(), 
      paidBy: requesterId,
      paymentMethod,
      transactionId
    };
    await setData(`payrollRecords/${id}`, updatedPayroll);

    // Send notification
    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [payroll.teacherId],
          title: 'Salary Credited',
          message: `Your salary of ₹${payroll.netSalary} for ${payroll.month} has been credited to your account.`,
          type: 'payroll',
          link: '/payroll'
        })
      });
    } catch (notifyErr) {
      console.warn('[Payroll] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, payrollRecord: updatedPayroll });
  } catch (err) {
    console.error('[Payroll] Mark as paid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/payroll/:id - Update payroll details
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const payroll = await getData(`payrollRecords/${id}`);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update paid payroll records' });
    }

    const { grossSalary, deductions, allowances, notes } = req.body;
    const updates: any = {};
    if (grossSalary) updates.grossSalary = grossSalary;
    if (deductions) updates.deductions = deductions;
    if (allowances) updates.allowances = allowances;
    if (notes !== undefined) updates.notes = notes;

    // Recalculate net salary if any financial fields changed
    if (grossSalary || deductions || allowances) {
      const newGross = grossSalary || payroll.grossSalary;
      const newDeductions = deductions || payroll.deductions;
      const newAllowances = allowances || payroll.allowances;
      const totalDeductions = newDeductions.reduce((sum: number, d: any) => sum + d.amount, 0);
      const totalAllowances = newAllowances.reduce((sum: number, a: any) => sum + a.amount, 0);
      updates.totalDeductions = totalDeductions;
      updates.totalAllowances = totalAllowances;
      updates.netSalary = newGross + totalAllowances - totalDeductions;
    }

    const updatedPayroll = { ...payroll, ...updates, updatedAt: new Date().toISOString() };
    await setData(`payrollRecords/${id}`, updatedPayroll);

    res.json({ success: true, payrollRecord: updatedPayroll });
  } catch (err) {
    console.error('[Payroll] Update payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/payroll/:id - Delete payroll record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const payroll = await getData(`payrollRecords/${id}`);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete paid payroll records' });
    }

    await setData(`payrollRecords/${id}`, null);
    res.json({ success: true, message: 'Payroll record deleted successfully' });
  } catch (err) {
    console.error('[Payroll] Delete payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payroll/bulk-create - Create multiple payroll records at once
router.post('/bulk-create', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { month, teacherIds, baseSalaryMap } = req.body;
    if (!month || !teacherIds || !Array.isArray(teacherIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const createdRecords = [];
    const errors = [];

    for (const teacherId of teacherIds) {
      try {
        const teacher = await getData(`users/${teacherId}`);
        if (!teacher) {
          errors.push({ teacherId, error: 'Teacher not found' });
          continue;
        }

        const existingPayroll = await listData('payrollRecords');
        const duplicate = existingPayroll.find(p => p.teacherId === teacherId && p.month === month);
        if (duplicate) {
          errors.push({ teacherId, error: 'Payroll already exists' });
          continue;
        }

        const grossSalary = baseSalaryMap?.[teacherId] || teacher.baseSalary || 0;
        if (!grossSalary) {
          errors.push({ teacherId, error: 'No base salary defined for teacher' });
          continue;
        }

        const payrollId = uuidv4();
        const payrollRecord = {
          id: payrollId,
          teacherId,
          teacherName: teacher.name,
          month,
          grossSalary,
          totalAllowances: 0,
          allowances: [],
          totalDeductions: 0,
          deductions: [],
          netSalary: grossSalary,
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: requesterId
        };

        await setData(`payrollRecords/${payrollId}`, payrollRecord);
        createdRecords.push(payrollRecord);
      } catch (err) {
        errors.push({ teacherId, error: 'Failed to create payroll' });
      }
    }

    res.json({
      success: true,
      created: createdRecords.length,
      failed: errors.length,
      createdRecords,
      errors
    });
  } catch (err) {
    console.error('[Payroll] Bulk create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;