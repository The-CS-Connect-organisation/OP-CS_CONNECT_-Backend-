import { asyncHandler } from '../utils/asyncHandler.js';
import { getRecord, queryRecords, updateRecord } from '../utils/supabaseDb.js';

/**
 * @desc    Save a generated study plan
 * @route   POST /api/school/study-plans
 */
export const saveStudyPlan = asyncHandler(async (req, res) => {
  const planId = `plan_${Date.now()}`;
  const plan = {
    id: planId,
    user_id: req.user.id,
    subject: req.body.subject,
    target_score: req.body.targetScore,
    test_date: req.body.testDate,
    weak_chapters: req.body.weakChapters,
    created_at: new Date().toISOString()
  };

  await updateRecord(`study_plans/${req.user.id}/${planId}`, plan);
  res.status(201).json({ success: true, plan });
});

/**
 * @desc    Get all study plans for the user
 * @route   GET /api/school/study-plans
 */
export const getMyStudyPlans = asyncHandler(async (req, res) => {
  const plans = await queryRecords(`study_plans/${req.user.id}`, () => true);
  res.json({ success: true, plans: plans.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});
