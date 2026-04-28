import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord } from '../utils/firebaseDb.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(requireAuth);

const createFeeSchema = z.object({
  body: z.object({
    studentId: z.string().min(1),
    term: z.string().trim().min(1).max(100),
    amount: z.number().positive(),
    dueDate: z.string(),
    description: z.string().trim().max(500).optional(),
  }),
});

const updateFeeSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'paid', 'overdue', 'waived']).optional(),
    paymentMethod: z.string().trim().max(50).optional(),
    transactionId: z.string().trim().max(100).optional(),
    paidAt: z.string().optional(),
  }),
  params: z.object({ feeId: z.string().min(1) }),
});

// List fees
router.get('/', allowRoles('admin', 'teacher', 'student', 'parent'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let fees = await getRecords('fees');

  // Students/parents only see their own fees
  if (req.user.role === 'student') {
    fees = fees.filter(f => f.student_id === req.user.id);
  } else if (req.user.role === 'parent') {
    // Get child IDs
    const parentProfile = await getRecord(`parent_profiles/${req.user.id}`);
    const childIds = parentProfile?.child_ids || [];
    if (childIds.length) {
      fees = fees.filter(f => childIds.includes(f.student_id));
    } else {
      fees = [];
    }
  } else if (req.query.studentId) {
    fees = fees.filter(f => f.student_id === req.query.studentId);
  }

  if (req.query.status) {
    fees = fees.filter(f => f.status === req.query.status);
  }

  // Sort by due_date ascending
  fees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const total = fees.length;
  const items = fees.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
}));

// Create fee (admin only)
router.post('/', allowRoles('admin'), validateRequest(createFeeSchema), asyncHandler(async (req, res) => {
  const { studentId, term, amount, dueDate, description } = req.body;

  const feeId = Date.now().toString();
  const fee = {
    id: feeId,
    student_id: studentId,
    term,
    amount,
    due_date: dueDate,
    description: description || null,
    status: 'pending',
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`fees/${feeId}`, fee);
  res.status(201).json({ success: true, fee });
}));

// Update fee status (admin) or pay fee (student)
router.patch('/:feeId', allowRoles('admin', 'student'), validateRequest(updateFeeSchema), asyncHandler(async (req, res) => {
  const existing = await getRecord(`fees/${req.params.feeId}`);
  if (!existing) throw new ApiError(404, 'Fee not found');

  // Students can only mark their own fees as paid
  if (req.user.role === 'student') {
    if (existing.student_id !== req.user.id) throw new ApiError(403, 'Forbidden');
    if (req.body.status && req.body.status !== 'paid') throw new ApiError(403, 'Students can only mark fees as paid');
  }

  const updates = {
    ...existing,
    updated_at: new Date().toISOString(),
  };

  if (req.body.status) updates.status = req.body.status;
  if (req.body.paymentMethod) updates.payment_method = req.body.paymentMethod;
  if (req.body.transactionId) updates.transaction_id = req.body.transactionId;
  if (req.body.status === 'paid') updates.paid_at = req.body.paidAt || new Date().toISOString();

  const fee = await updateRecord(`fees/${req.params.feeId}`, updates);
  res.json({ success: true, fee });
}));

// Delete fee (admin only)
router.delete('/:feeId', allowRoles('admin'), asyncHandler(async (req, res) => {
  await deleteRecord(`fees/${req.params.feeId}`);
  res.json({ success: true, message: 'Fee deleted' });
}));

export default router;
