import { Request, Response, Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// GET /api/fees
router.get('/', async (req: Request, res: Response) => {
  try {
    const allFees = await listData('feeRecords');
    res.json(allFees || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fee records' });
  }
});


// GET /api/fees/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { studentId } = req.params;
    if (requesterId !== studentId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your own fees' });
      }
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const allFees = await listData('feeRecords');
    const studentFees = allFees.filter(f => f.studentId === studentId);
    
    const pending = studentFees.filter(f => f.status === 'pending');
    const paid = studentFees.filter(f => f.status === 'paid');
    const totalPending = pending.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = paid.reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      student: { id: studentId, name: student.name, class: student.class },
      pendingFees: pending.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
      paidHistory: paid.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      summary: { totalPending, totalPaid }
    });
  } catch (err) {
    console.error('[Fees] Get student fees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fees/pay
router.post('/pay', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { feeRecordId, paymentMethod, transactionId } = req.body;
    if (!feeRecordId || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const feeRecord = await getData(`feeRecords/${feeRecordId}`);
    if (!feeRecord) {
      return res.status(404).json({ error: 'Fee record not found' });
    }

    if (feeRecord.studentId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Cannot pay for another student' });
      }
    }

    if (feeRecord.status === 'paid') {
      return res.status(400).json({ error: 'This fee has already been paid' });
    }

    const updatedRecord = {
      ...feeRecord,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentMethod,
      transactionId: transactionId || `txn_${id('txn')}`,
      paidBy: requesterId
    };

    await setData(`feeRecords/${feeRecordId}`, updatedRecord);

    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [feeRecord.studentId],
          title: 'Fee Payment Successful',
          message: `You have paid ₹${feeRecord.amount} for ${feeRecord.feeType}. Payment ID: ${updatedRecord.transactionId}`,
          type: 'fee',
          link: '/fees'
        })
      });
    } catch (notifyErr) {
      console.warn('[Fees] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, feeRecord: updatedRecord });
  } catch (err) {
    console.error('[Fees] Process payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fees/create
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

    const { studentId, feeType, amount, dueDate, description = '' } = req.body;
    if (!studentId || !feeType || !amount || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const feeId = id('fee');
    const feeRecord = {
      id: feeId,
      studentId,
      studentName: student.name,
      feeType,
      amount,
      dueDate,
      description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`feeRecords/${feeId}`, feeRecord);

    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [studentId],
          title: 'New Fee Created',
          message: `A new fee of ₹${amount} (${feeType}) has been added. Due date: ${new Date(dueDate).toLocaleDateString()}`,
          type: 'fee',
          link: '/fees'
        })
      });
    } catch (notifyErr) {
      console.warn('[Fees] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, feeRecord });
  } catch (err) {
    console.error('[Fees] Create fee error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fees/pending
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const allFees = await listData('feeRecords');
    const pendingFees = allFees.filter(f => f.status === 'pending');
    const overdue = pendingFees.filter(f => new Date(f.dueDate) < new Date());
    
    const totalPending = pendingFees.reduce((sum, f) => sum + f.amount, 0);
    const totalOverdue = overdue.reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      totalPending,
      totalOverdue,
      pendingFees: pendingFees.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      overdueCount: overdue.length
    });
  } catch (err) {
    console.error('[Fees] Get pending fees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fees/reports/monthly
router.get('/reports/monthly', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'accountant'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const allFees = await listData('feeRecords');
    
    const monthlyPaid = allFees.filter(f => 
      f.status === 'paid' && f.paidAt && f.paidAt.startsWith(month)
    );
    const totalCollected = monthlyPaid.reduce((sum, f) => sum + f.amount, 0);
    
    const feeTypeBreakdown: { [key: string]: number } = {};
    monthlyPaid.forEach(f => {
      feeTypeBreakdown[f.feeType] = (feeTypeBreakdown[f.feeType] || 0) + f.amount;
    });

    res.json({
      success: true,
      month,
      totalCollected,
      transactionCount: monthlyPaid.length,
      feeTypeBreakdown
    });
  } catch (err) {
    console.error('[Fees] Monthly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;