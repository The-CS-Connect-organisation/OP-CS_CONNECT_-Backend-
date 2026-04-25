import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();
router.use(requireAuth);

const uuidField = z.string().uuid('Invalid UUID');

const createFeeSchema = z.object({
  body: z.object({
    studentId: uuidField,
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
  params: z.object({ feeId: uuidField }),
});

// List fees
router.get('/', allowRoles('admin', 'teacher', 'student', 'parent'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let query = supabase.from('fees').select('*', { count: 'exact' });

  // Students/parents only see their own fees
  if (req.user.role === 'student') {
    query = query.eq('student_id', req.user.id);
  } else if (req.user.role === 'parent') {
    // Get child IDs
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('child_ids')
      .eq('user_id', req.user.id)
      .maybeSingle();
    const childIds = parentProfile?.child_ids || [];
    if (childIds.length) query = query.in('student_id', childIds);
    else return res.json({ success: true, items: [], pagination: { total: 0, page, limit, totalPages: 0 } });
  } else if (req.query.studentId) {
    query = query.eq('student_id', req.query.studentId);
  }

  if (req.query.status) query = query.eq('status', req.query.status);

  const { data: items, count: total, error } = await query
    .order('due_date', { ascending: true })
    .range(skip, skip + limit - 1);

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, ...buildPaginatedResponse({ items: items || [], total: total || 0, page, limit }) });
}));

// Create fee (admin only)
router.post('/', allowRoles('admin'), validateRequest(createFeeSchema), asyncHandler(async (req, res) => {
  const { studentId, term, amount, dueDate, description } = req.body;

  const { data: fee, error } = await supabase
    .from('fees')
    .insert({
      student_id: studentId,
      term,
      amount,
      due_date: dueDate,
      description: description || null,
      status: 'pending',
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, fee });
}));

// Update fee status (admin) or pay fee (student)
router.patch('/:feeId', allowRoles('admin', 'student'), validateRequest(updateFeeSchema), asyncHandler(async (req, res) => {
  const { data: existing } = await supabase
    .from('fees')
    .select('*')
    .eq('id', req.params.feeId)
    .single();

  if (!existing) throw new ApiError(404, 'Fee not found');

  // Students can only mark their own fees as paid
  if (req.user.role === 'student') {
    if (existing.student_id !== req.user.id) throw new ApiError(403, 'Forbidden');
    if (req.body.status && req.body.status !== 'paid') throw new ApiError(403, 'Students can only mark fees as paid');
  }

  const updates = {};
  if (req.body.status) updates.status = req.body.status;
  if (req.body.paymentMethod) updates.payment_method = req.body.paymentMethod;
  if (req.body.transactionId) updates.transaction_id = req.body.transactionId;
  if (req.body.status === 'paid') updates.paid_at = req.body.paidAt || new Date().toISOString();

  const { data: fee, error } = await supabase
    .from('fees')
    .update(updates)
    .eq('id', req.params.feeId)
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, fee });
}));

// Delete fee (admin only)
router.delete('/:feeId', allowRoles('admin'), asyncHandler(async (req, res) => {
  const { error } = await supabase.from('fees').delete().eq('id', req.params.feeId);
  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, message: 'Fee deleted' });
}));

export default router;
