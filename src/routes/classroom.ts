import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Courses / Classes ---
router.get('/courses', async (req, res) => {
  try {
    const users = await listData('users');
    const classNames = new Set(
      users.filter((u: any) => u.role === 'student' && u.class)
           .map((u: any) => u.class)
    );
    const classes = Array.from(classNames).map(name => ({ id: name, name: name }));
    res.json(classes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// --- Lesson Plans (Phase 1) ---
router.post('/lesson-plans', async (req, res) => {
  try {
    const plan = { id: id('lp'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`lessonPlans/${plan.id}`, plan);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create lesson plan' });
  }
});

router.get('/lesson-plans', async (req, res) => {
  try {
    let plans = await listData('lessonPlans');
    const { class: className, subject, teacherId } = req.query;
    if (className) plans = plans.filter((p: any) => p.class === className);
    if (subject) plans = plans.filter((p: any) => p.subject === subject);
    if (teacherId) plans = plans.filter((p: any) => p.teacherId === teacherId);
    res.json(plans.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch lesson plans' });
  }
});

router.put('/lesson-plans/:id', async (req, res) => {
  try {
    const existing = await getData(`lessonPlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`lessonPlans/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update lesson plan' });
  }
});

router.delete('/lesson-plans/:id', async (req, res) => {
  try {
    const existing = await getData(`lessonPlans/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await setData(`lessonPlans/${req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete lesson plan' });
  }
});

// --- Rubrics (Phase 1) ---
router.post('/rubrics', async (req, res) => {
  try {
    const rubric = { id: id('rub'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`rubrics/${rubric.id}`, rubric);
    res.status(201).json(rubric);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create rubric' });
  }
});

router.get('/rubrics', async (req, res) => {
  try {
    let rubrics = await listData('rubrics');
    const { subjectId, teacherId } = req.query;
    if (subjectId) rubrics = rubrics.filter((r: any) => r.subjectId === subjectId);
    if (teacherId) rubrics = rubrics.filter((r: any) => r.teacherId === teacherId);
    res.json(rubrics);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rubrics' });
  }
});

// --- Peer Review (Phase 1) ---
router.post('/assignments/:id/peer-review', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.id}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const { reviewerId, revieweeId, score, feedback } = req.body;
    const review = {
      id: id('pr'), assignmentId: req.params.id, reviewerId, revieweeId,
      score, feedback, createdAt: new Date().toISOString(),
    };
    const reviews = await listData(`peerReviews/${req.params.id}`);
    reviews.push(review);
    await setData(`peerReviews/${req.params.id}`, Object.fromEntries(reviews.map((r: any) => [r.id, r])));
    res.status(201).json(review);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit peer review' });
  }
});

router.get('/assignments/:id/peer-reviews', async (req, res) => {
  try {
    const reviews = await listData(`peerReviews/${req.params.id}`);
    const { studentId } = req.query;
    if (studentId) return res.json(reviews.filter((r: any) => r.revieweeId === studentId));
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch peer reviews' });
  }
});

// --- Hall Passes (Phase 1) ---
router.post('/hall-passes', async (req, res) => {
  try {
    const pass = { id: id('hp'), ...req.body, status: 'active', issuedAt: new Date().toISOString() };
    await setData(`hallPasses/${pass.id}`, pass);
    res.status(201).json(pass);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create hall pass' });
  }
});

router.put('/hall-passes/:id/return', async (req, res) => {
  try {
    const pass = await getData(`hallPasses/${req.params.id}`);
    if (!pass) return res.status(404).json({ error: 'Pass not found' });
    pass.status = 'returned';
    pass.returnedAt = new Date().toISOString();
    await setData(`hallPasses/${req.params.id}`, pass);
    res.json(pass);
  } catch (e) {
    res.status(500).json({ error: 'Failed to return pass' });
  }
});

router.get('/hall-passes', async (req, res) => {
  try {
    let passes = await listData('hallPasses');
    const { studentId, status } = req.query;
    if (studentId) passes = passes.filter((p: any) => p.studentId === studentId);
    if (status) passes = passes.filter((p: any) => p.status === status);
    res.json(passes.sort((a: any, b: any) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

// --- Progress Notes (Phase 1) ---
router.post('/progress-notes', async (req, res) => {
  try {
    const note = { id: id('pn'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`progressNotes/${note.id}`, note);
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create progress note' });
  }
});

router.get('/progress-notes/:studentId', async (req, res) => {
  try {
    const notes = await listData('progressNotes');
    res.json(notes.filter((n: any) => n.studentId === req.params.studentId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch progress notes' });
  }
});

// --- Learning Paths / Programs (Phase 1) ---
router.post('/programs', async (req, res) => {
  try {
    const program = { id: id('prog'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`programs/${program.id}`, program);
    res.status(201).json(program);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create program' });
  }
});

router.get('/programs', async (_req, res) => {
  try {
    const programs = await listData('programs');
    res.json(programs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// --- Courses/Lessons content types (Phase 1) ---
router.post('/courses', async (req, res) => {
  try {
    const course = { id: id('crs'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`courses/${course.id}`, course);
    res.status(201).json(course);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    let courses = await listData('courses');
    const { class: className, teacherId } = req.query;
    if (className) courses = courses.filter((c: any) => c.class === className);
    if (teacherId) courses = courses.filter((c: any) => c.teacherId === teacherId);
    res.json(courses);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.post('/courses/:id/lessons', async (req, res) => {
  try {
    const lesson = { id: id('lsn'), courseId: req.params.id, ...req.body, createdAt: new Date().toISOString() };
    await setData(`lessons/${lesson.id}`, lesson);
    res.status(201).json(lesson);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

router.get('/courses/:id/lessons', async (req, res) => {
  try {
    const lessons = await listData('lessons');
    res.json(lessons.filter((l: any) => l.courseId === req.params.id)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// --- Course Certificates (Phase 1) ---
router.post('/certificates', async (req, res) => {
  try {
    const cert = { id: id('cert'), ...req.body, issuedAt: new Date().toISOString() };
    await setData(`certificates/${cert.id}`, cert);
    res.status(201).json(cert);
  } catch (e) {
    res.status(500).json({ error: 'Failed to issue certificate' });
  }
});

router.get('/certificates/:studentId', async (req, res) => {
  try {
    const certs = await listData('certificates');
    res.json(certs.filter((c: any) => c.studentId === req.params.studentId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// --- Exercises (Phase 1) ---
router.post('/exercises', async (req, res) => {
  try {
    const exercise = { id: id('exr'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`exercises/${exercise.id}`, exercise);
    res.status(201).json(exercise);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

router.get('/exercises/:courseId', async (req, res) => {
  try {
    const exercises = await listData('exercises');
    res.json(exercises.filter((e: any) => e.courseId === req.params.courseId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// --- Interactive exercises / quizzes ---
router.post('/exercises/:id/submit', async (req, res) => {
  try {
    const exercise = await getData(`exercises/${req.params.id}`);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    const submission = { id: id('exs'), exerciseId: req.params.id, ...req.body, submittedAt: new Date().toISOString() };
    await setData(`exerciseSubmissions/${submission.id}`, submission);
    res.status(201).json(submission);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit exercise' });
  }
});

router.put('/exercises/:id/grade', async (req, res) => {
  try {
    const sub = await getData(`exerciseSubmissions/${req.params.id}`);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    sub.score = req.body.score;
    sub.feedback = req.body.feedback;
    sub.gradedAt = new Date().toISOString();
    await setData(`exerciseSubmissions/${req.params.id}`, sub);
    res.json(sub);
  } catch (e) {
    res.status(500).json({ error: 'Failed to grade submission' });
  }
});

// --- Frontend-compatible aliases ---

// GET /classroom/exercises (bare, with ?subject= query)
router.get('/exercises', async (req, res) => {
  try {
    let exercises = await listData('exercises');
    const { subject } = req.query;
    if (subject) exercises = exercises.filter((e: any) => e.subjectId === subject || e.subject === subject);
    res.json(exercises);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// GET /classroom/peer-review/:assignmentId
router.get('/peer-review/:assignmentId', async (req, res) => {
  try {
    const reviews = await listData(`peerReviews/${req.params.assignmentId}`);
    const { studentId } = req.query;
    if (studentId) return res.json(reviews.filter((r: any) => r.revieweeId === studentId));
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch peer reviews' });
  }
});

// POST /classroom/peer-review/:assignmentId
router.post('/peer-review/:assignmentId', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.assignmentId}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const { reviewerId, revieweeId, score, feedback } = req.body;
    const review = {
      id: id('pr'), assignmentId: req.params.assignmentId, reviewerId, revieweeId,
      score, feedback, createdAt: new Date().toISOString(),
    };
    const reviews = await listData(`peerReviews/${req.params.assignmentId}`);
    reviews.push(review);
    await setData(`peerReviews/${req.params.assignmentId}`, Object.fromEntries(reviews.map((r: any) => [r.id, r])));
    res.status(201).json(review);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit peer review' });
  }
});

// GET /classroom/rooms — list physical rooms
router.get('/rooms', async (_req, res) => {
  try {
    const rooms = await listData('rooms');
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /classroom/lessons/:courseId → GET /courses/:courseId/lessons
router.get('/lessons/:courseId', async (req, res) => {
  try {
    const lessons = await listData('lessons');
    res.json(lessons.filter((l: any) => l.courseId === req.params.courseId)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// POST /classroom/lessons/:courseId → POST /courses/:courseId/lessons
router.post('/lessons/:courseId', async (req, res) => {
  try {
    const lesson = { id: id('lsn'), courseId: req.params.courseId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`lessons/${lesson.id}`, lesson);
    res.status(201).json(lesson);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// POST /classroom/progress-notes/:studentId
router.post('/progress-notes/:studentId', async (req, res) => {
  try {
    const note = { id: id('pn'), studentId: req.params.studentId, ...req.body, createdAt: new Date().toISOString() };
    await setData(`progressNotes/${note.id}`, note);
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create progress note' });
  }
});

// PUT /classroom/hall-passes/:id/end → alias for /return
router.put('/hall-passes/:id/end', async (req, res) => {
  try {
    const pass = await getData(`hallPasses/${req.params.id}`);
    if (!pass) return res.status(404).json({ error: 'Pass not found' });
    pass.status = 'returned';
    pass.returnedAt = new Date().toISOString();
    await setData(`hallPasses/${req.params.id}`, pass);
    res.json(pass);
  } catch (e) {
    res.status(500).json({ error: 'Failed to end pass' });
  }
});

export default router;
