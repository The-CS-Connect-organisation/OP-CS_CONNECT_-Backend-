import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, updateRecord, createRecord, deleteRecord, batchWrite } from '../utils/firebaseDb.js';

// ── Exams ──
export const createExam = asyncHandler(async (req, res) => {
  const examId = Date.now().toString();
  const exam = {
    id: examId,
    name: req.body.name,
    subject: req.body.subject,
    class_id: req.body.classId || req.body.class_id || req.body.class || null,
    class_name: req.body.className || req.body.className || req.body.class || null,
    date: req.body.date,
    max_marks: req.body.maxMarks || req.body.max_marks || 100,
    paper_url: req.file ? `/uploads/${req.file.filename}` : req.body.paperUrl || null,
    paper_name: req.file ? req.file.originalname : req.body.paperName || null,
    created_by: req.user.id,
    status: 'scheduled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`exams/${examId}`, exam);
  res.status(201).json({ success: true, exam });
});

export const listExams = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { classId, subject, status } = req.query;

  let exams = await getRecords('exams');

  if (classId) exams = exams.filter(e => e.class_id === classId || e.class === classId);
  if (subject) exams = exams.filter(e => e.subject === subject);
  if (status) exams = exams.filter(e => e.status === status);

  exams.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = exams.length;
  const items = exams.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

export const getExam = asyncHandler(async (req, res) => {
  const exam = await getRecord(`exams/${req.params.examId}`);
  if (!exam) throw new ApiError(404, 'Exam not found');
  res.json({ success: true, exam });
});

export const updateExam = asyncHandler(async (req, res) => {
  const existing = await getRecord(`exams/${req.params.examId}`);
  if (!existing) throw new ApiError(404, 'Exam not found');

  const updated = {
    ...existing,
    ...(req.body.name !== undefined && { name: req.body.name }),
    ...(req.body.subject !== undefined && { subject: req.body.subject }),
    ...(req.body.classId !== undefined && { class_id: req.body.classId }),
    ...(req.body.date !== undefined && { date: req.body.date }),
    ...(req.body.maxMarks !== undefined && { max_marks: req.body.maxMarks }),
    ...(req.body.max_marks !== undefined && { max_marks: req.body.max_marks }),
    ...(req.body.status !== undefined && { status: req.body.status }),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`exams/${req.params.examId}`, updated);
  res.json({ success: true, exam: updated });
});

export const deleteExam = asyncHandler(async (req, res) => {
  const existing = await getRecord(`exams/${req.params.examId}`);
  if (!existing) throw new ApiError(404, 'Exam not found');
  await deleteRecord(`exams/${req.params.examId}`);
  res.json({ success: true, message: 'Exam deleted' });
});

// ── Questions ──
export const createQuestion = asyncHandler(async (req, res) => {
  const questionId = Date.now().toString();
  const question = {
    id: questionId,
    type: req.body.type || 'mcq',
    class_id: req.body.classId || req.body.class_id || req.body.class || null,
    class_name: req.body.className || req.body.class || null,
    subject: req.body.subject,
    text: req.body.text,
    options: req.body.options || [],
    correct_index: req.body.correctIndex ?? req.body.correct_index ?? 0,
    marks: req.body.marks || 1,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`questions/${questionId}`, question);
  res.status(201).json({ success: true, question });
});

export const listQuestions = asyncHandler(async (req, res) => {
  const { classId, subject } = req.query;

  let questions = await getRecords('questions');

  if (classId) questions = questions.filter(q => q.class_id === classId || q.class === classId);
  if (subject) questions = questions.filter(q => q.subject === subject);

  res.json({ success: true, questions });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const existing = await getRecord(`questions/${req.params.questionId}`);
  if (!existing) throw new ApiError(404, 'Question not found');
  await deleteRecord(`questions/${req.params.questionId}`);
  res.json({ success: true, message: 'Question deleted' });
});

export const bulkCreateQuestions = asyncHandler(async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions)) throw new ApiError(400, 'questions array is required');

  const operations = questions.map((q) => ({
    path: `questions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    data: {
      ...q,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    operation: 'set',
  }));

  await batchWrite(operations);
  res.status(201).json({ success: true, count: questions.length });
});

// ── Attempts ──
export const startAttempt = asyncHandler(async (req, res) => {
  const attemptId = `${req.params.examId}-${req.user.id}-${Date.now()}`;
  const attempt = {
    id: attemptId,
    exam_id: req.params.examId,
    student_id: req.user.id,
    started_at: new Date().toISOString(),
    finished_at: null,
    answers: req.body.answers || {},
    question_ids: req.body.questionIds || [],
    score: null,
    max_score: req.body.maxScore || 0,
    status: 'in_progress',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`attempts/${attemptId}`, attempt);
  res.status(201).json({ success: true, attempt });
});

export const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await getRecord(`attempts/${req.params.attemptId}`);
  if (!attempt) throw new ApiError(404, 'Attempt not found');

  // Students can only view their own attempts
  if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ success: true, attempt });
});

export const updateAttempt = asyncHandler(async (req, res) => {
  const existing = await getRecord(`attempts/${req.params.attemptId}`);
  if (!existing) throw new ApiError(404, 'Attempt not found');

  if (existing.student_id !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (existing.status === 'completed') {
    throw new ApiError(400, 'Attempt already completed');
  }

  const { answers, finished, score } = req.body;

  const updated = {
    ...existing,
    ...(answers !== undefined && { answers }),
    ...(finished === true && { status: 'completed', finished_at: new Date().toISOString() }),
    ...(score !== undefined && { score }),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`attempts/${req.params.attemptId}`, updated);
  res.json({ success: true, attempt: updated });
});

export const listAttempts = asyncHandler(async (req, res) => {
  const { examId, studentId } = req.query;

  let attempts = await getRecords('attempts');

  if (examId) attempts = attempts.filter(a => a.exam_id === examId);
  if (studentId) attempts = attempts.filter(a => a.student_id === studentId);

  if (req.user.role === 'student') {
    attempts = attempts.filter(a => a.student_id === req.user.id);
  }

  attempts.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  res.json({ success: true, attempts });
});
