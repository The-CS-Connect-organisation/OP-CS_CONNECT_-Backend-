import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Exam Results Workflow (Phase 1) ---
router.post('/:id/results/enter', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const { entries } = req.body;
    if (!entries) return res.status(400).json({ error: 'entries required' });
    for (const e of entries) {
      await setData(`examResults/${req.params.id}/${e.studentId}`, {
        studentId: e.studentId, marks: e.marks, grade: e.grade || '',
        remarks: e.remarks || '', enteredBy: e.enteredBy,
        enteredAt: new Date().toISOString(), status: 'entered',
      });
    }
    // Check if all students have results
    const users = await listData('users');
    const classStudents = users.filter((u: any) => u.role === 'student' && u.class === exam.class);
    const results = await getData(`examResults/${req.params.id}`);
    const resultCount = results ? Object.keys(results).length : 0;
    await setData(`exams/${req.params.id}/resultStatus`, resultCount >= classStudents.length ? 'complete' : 'partial');
    res.json({ success: true, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to enter results' });
  }
});

router.post('/:id/results/approve', async (req, res) => {
  try {
    const { approvedBy } = req.body;
    const results = await getData(`examResults/${req.params.id}`);
    if (!results) return res.status(404).json({ error: 'No results found' });
    for (const [sid, result] of Object.entries(results as any)) {
      (result as any).status = 'approved';
      (result as any).approvedBy = approvedBy;
      (result as any).approvedAt = new Date().toISOString();
      await setData(`examResults/${req.params.id}/${sid}`, result);
    }
    await setData(`exams/${req.params.id}/resultStatus`, 'approved');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve results' });
  }
});

router.post('/:id/results/publish', async (req, res) => {
  try {
    await setData(`exams/${req.params.id}/resultStatus`, 'published');
    await setData(`exams/${req.params.id}/publishedAt`, new Date().toISOString());
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to publish results' });
  }
});

router.get('/:id/results', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const results = await getData(`examResults/${req.params.id}`);
    if (!results) return res.json([]);
    const resultList = Object.entries(results as any).map(([studentId, data]) => ({ studentId, ...(data as any) }));
    // Enhance with student names
    const users = await listData('users');
    const enhanced = resultList.map((r: any) => {
      const student = users.find((u: any) => u.id === r.studentId);
      return { ...r, studentName: student?.name || 'Unknown', avatar: student?.avatar || '' };
    });
    res.json({ exam, results: enhanced, status: exam.resultStatus });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

router.get('/:id/results/summary', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const results = await getData(`examResults/${req.params.id}`);
    if (!results) return res.json({ total: 0, passed: 0, failed: 0, average: 0 });
    const marks = Object.values(results as any).map((r: any) => r.marks);
    const passMarks = req.query.passMarks ? Number(req.query.passMarks) : (exam.totalMarks || 100) * 0.35;
    const total = marks.length;
    const passed = marks.filter((m: number) => m >= passMarks).length;
    const average = marks.length ? (marks.reduce((a: number, b: number) => a + b, 0) / marks.length) : 0;
    const maxMark = marks.length ? Math.max(...marks) : 0;
    const minMark = marks.length ? Math.min(...marks) : 0;
    res.json({ total, passed, failed: total - passed, average: Math.round(average * 100) / 100, maxMark, minMark, passMarks });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/:id/grade-card', async (req, res) => {
  try {
    const studentId = req.query.studentId as string;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });
    const exam = await getData(`exams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const result = await getData(`examResults/${req.params.id}/${studentId}`);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json({ exam, result });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch grade card' });
  }
});

// --- Grace Marks (Phase 1) ---
router.post('/:id/grace-marks', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries) return res.status(400).json({ error: 'entries required' });
    for (const e of entries) {
      const existing = await getData(`examResults/${req.params.id}/${e.studentId}`);
      if (existing) {
        existing.graceMarks = (existing.graceMarks || 0) + (e.graceMarks || 0);
        existing.marks = (existing.marks || 0) + (e.graceMarks || 0);
        existing.updatedAt = new Date().toISOString();
        await setData(`examResults/${req.params.id}/${e.studentId}`, existing);
      }
    }
    res.json({ success: true, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to apply grace marks' });
  }
});

// --- Online Exams (Phase 1) ---
router.post('/online/create', async (req, res) => {
  try {
    const exam = { id: id('oe'), ...req.body, status: 'draft', createdAt: new Date().toISOString() };
    await setData(`onlineExams/${exam.id}`, exam);
    res.status(201).json(exam);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create online exam' });
  }
});

router.get('/online', async (req, res) => {
  try {
    const exams = await listData('onlineExams');
    const { class: className, status } = req.query;
    let filtered = exams;
    if (className) filtered = filtered.filter((e: any) => e.class === className);
    if (status) filtered = filtered.filter((e: any) => e.status === status);
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch online exams' });
  }
});

router.post('/online/:id/start', async (req, res) => {
  try {
    const exam = await getData(`onlineExams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const attempt = {
      id: id('oa'), examId: req.params.id, studentId: req.body.studentId,
      startedAt: new Date().toISOString(), status: 'in-progress', answers: {},
    };
    await setData(`onlineExamAttempts/${attempt.id}`, attempt);
    res.status(201).json({ attempt, exam });
  } catch (e) {
    res.status(500).json({ error: 'Failed to start exam' });
  }
});

router.post('/online/attempts/:id/submit', async (req, res) => {
  try {
    const attempt = await getData(`onlineExamAttempts/${req.params.id}`);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    const { answers } = req.body;
    attempt.answers = answers;
    attempt.submittedAt = new Date().toISOString();
    attempt.status = 'submitted';
    // Auto-calculate score if MCQ
    const exam = await getData(`onlineExams/${attempt.examId}`);
    if (exam?.questions) {
      let score = 0;
      const total = exam.questions.length;
      for (const q of exam.questions) {
        if (q.type === 'mcq' && answers[q.id] === q.correctAnswer) score++;
      }
      attempt.score = score;
      attempt.totalMarks = total;
    }
    await setData(`onlineExamAttempts/${req.params.id}`, attempt);
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit exam' });
  }
});

router.get('/online/attempts/:studentId', async (req, res) => {
  try {
    const attempts = await listData('onlineExamAttempts');
    res.json(attempts.filter((a: any) => a.studentId === req.params.studentId)
      .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// --- Result Analytics (Phase 1) ---
router.get('/analytics/class/:class', async (req, res) => {
  try {
    const exams = await listData('exams');
    const classExams = exams.filter((e: any) => e.class === req.params.class);
    const analytics: any[] = [];
    for (const exam of classExams) {
      const results = await getData(`examResults/${exam.id}`);
      if (!results) continue;
      const marks = Object.values(results as any).map((r: any) => r.marks);
      analytics.push({
        examId: exam.id, examTitle: exam.title, subjectId: exam.subjectId,
        date: exam.date, totalStudents: marks.length,
        average: marks.length ? Math.round((marks.reduce((a: number, b: number) => a + b, 0) / marks.length) * 100) / 100 : 0,
        highest: marks.length ? Math.max(...marks) : 0,
        lowest: marks.length ? Math.min(...marks) : 0,
      });
    }
    res.json(analytics);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// --- Frontend-compatible aliases ---

// GET /exams/results/:examId → GET /:examId/results
router.get('/results/:examId', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.examId}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const results = await getData(`examResults/${req.params.examId}`);
    if (!results) return res.json([]);
    const resultList = Object.entries(results as any).map(([studentId, data]) => ({ studentId, ...(data as any) }));
    const users = await listData('users');
    const enhanced = resultList.map((r: any) => {
      const student = users.find((u: any) => u.id === r.studentId);
      return { ...r, studentName: student?.name || 'Unknown', avatar: student?.avatar || '' };
    });
    res.json({ exam, results: enhanced, status: exam.resultStatus });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// POST /exams/results/:examId → POST /:examId/results/enter
router.post('/results/:examId', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.examId}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const { entries } = req.body;
    if (!entries) return res.status(400).json({ error: 'entries required' });
    for (const e of entries) {
      await setData(`examResults/${req.params.examId}/${e.studentId}`, {
        studentId: e.studentId, marks: e.marks, grade: e.grade || '',
        remarks: e.remarks || '', enteredBy: e.enteredBy,
        enteredAt: new Date().toISOString(), status: 'entered',
      });
    }
    const users = await listData('users');
    const classStudents = users.filter((u: any) => u.role === 'student' && u.class === exam.class);
    const results = await getData(`examResults/${req.params.examId}`);
    const resultCount = results ? Object.keys(results).length : 0;
    await setData(`exams/${req.params.examId}/resultStatus`, resultCount >= classStudents.length ? 'complete' : 'partial');
    res.json({ success: true, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to enter results' });
  }
});

// POST /exams/results/:examId/publish → POST /:examId/results/publish
router.post('/results/:examId/publish', async (req, res) => {
  try {
    await setData(`exams/${req.params.examId}/resultStatus`, 'published');
    await setData(`exams/${req.params.examId}/publishedAt`, new Date().toISOString());
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to publish results' });
  }
});

// POST /exams/grace/:examId → POST /:examId/grace-marks
router.post('/grace/:examId', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!entries) return res.status(400).json({ error: 'entries required' });
    for (const e of entries) {
      const existing = await getData(`examResults/${req.params.examId}/${e.studentId}`);
      if (existing) {
        existing.graceMarks = (existing.graceMarks || 0) + (e.graceMarks || 0);
        existing.marks = (existing.marks || 0) + (e.graceMarks || 0);
        existing.updatedAt = new Date().toISOString();
        await setData(`examResults/${req.params.examId}/${e.studentId}`, existing);
      }
    }
    res.json({ success: true, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to apply grace marks' });
  }
});

// GET /exams/online/:id → get single online exam
router.get('/online/:id', async (req, res) => {
  try {
    const exam = await getData(`onlineExams/${req.params.id}`);
    if (!exam) return res.status(404).json({ error: 'Online exam not found' });
    res.json(exam);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch online exam' });
  }
});

// POST /exams/online/:examId/submit → start attempt by exam ID
router.post('/online/:examId/submit', async (req, res) => {
  try {
    const exam = await getData(`onlineExams/${req.params.examId}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const attempt = {
      id: id('oa'), examId: req.params.examId, studentId: req.body.studentId,
      startedAt: new Date().toISOString(), status: 'in-progress', answers: {},
    };
    await setData(`onlineExamAttempts/${attempt.id}`, attempt);
    res.status(201).json({ attempt, exam });
  } catch (e) {
    res.status(500).json({ error: 'Failed to start exam' });
  }
});

// POST /exams/online/:examId/grade/:studentId
router.post('/online/:examId/grade/:studentId', async (req, res) => {
  try {
    const attempts = await listData('onlineExamAttempts');
    const attempt = attempts.find((a: any) => a.examId === req.params.examId && a.studentId === req.params.studentId);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    attempt.status = 'graded';
    attempt.gradedAt = new Date().toISOString();
    await setData(`onlineExamAttempts/${attempt.id}`, attempt);
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ error: 'Failed to grade exam' });
  }
});

// GET /exams/analytics/:examId → single exam analytics
router.get('/analytics/:examId', async (req, res) => {
  try {
    const exam = await getData(`exams/${req.params.examId}`);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const results = await getData(`examResults/${req.params.examId}`);
    if (!results) return res.json({ examId: req.params.examId, examTitle: exam.title, totalStudents: 0, average: 0, highest: 0, lowest: 0 });
    const marks = Object.values(results as any).map((r: any) => r.marks);
    res.json({
      examId: req.params.examId, examTitle: exam.title,
      totalStudents: marks.length,
      average: marks.length ? Math.round((marks.reduce((a: number, b: number) => a + b, 0) / marks.length) * 100) / 100 : 0,
      highest: marks.length ? Math.max(...marks) : 0,
      lowest: marks.length ? Math.min(...marks) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
