import { Router } from 'express';
import pkgMulter from 'multer';
const multer = pkgMulter.default || pkgMulter;
import {
  createAnnouncement,
  createAssignment,
  createClassRoom,
  createMark,
  createStudentProfile,
  createTeacherProfile,
  getAttendanceReport,
  getLeaderboard,
  getReportCard,
  getTimetable,
  listAnnouncements,
  listAssignments,
  listMessages,
  listStudents,
  listTeachers,
  markAttendance,
  markMessageRead,
  saveTimetable,
  sendMessage,
  submitAssignment,
  gradeSubmission,
  getStreamToken,
  getExpandedStudentProfile,
  getUser,
  listUsers,
} from '../controllers/schoolController.js';
import { getAllClubs, createClub, joinClub, sendClubMessage, getClubMessages, uploadResearchPaper, getClubLeaderboard } from '../controllers/clubsController.js';
import { saveStudyPlan, getMyStudyPlans } from '../controllers/studyPlannerController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createAnnouncementSchema,
  createAssignmentSchema,
  createClassSchema,
  createMarkSchema,
  createStudentProfileSchema,
  createTeacherProfileSchema,
  gradeSubmissionSchema,
  markAttendanceSchema,
  saveTimetableSchema,
  sendMessageSchema,
  submitAssignmentSchema,
} from '../validators/schoolValidators.js';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Public endpoints - no auth required
router.get('/stream-token', getStreamToken);
router.get('/clubs', getAllClubs);

router.use(requireAuth);

// Messages (authenticated — use req.user.id)
router.get('/messages', listMessages);
router.post('/messages', sendMessage);
router.patch('/messages/:messageId/read', markMessageRead);

router.get('/classes', allowRoles('admin', 'teacher', 'student', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const classes = await getRecords('class_rooms');
  res.json({ success: true, classes, classRooms: classes, items: classes });
}));

router.post('/classes', allowRoles('admin'), validateRequest(createClassSchema), createClassRoom);
router.post('/students/profiles', allowRoles('admin'), validateRequest(createStudentProfileSchema), createStudentProfile);
router.post('/teachers/profiles', allowRoles('admin'), validateRequest(createTeacherProfileSchema), createTeacherProfile);
router.get('/students', allowRoles('admin', 'teacher', 'student', 'parent'), listStudents);
router.get('/students/:studentId/profile', allowRoles('admin', 'teacher', 'student', 'parent'), getExpandedStudentProfile);
router.get('/teachers', allowRoles('admin', 'teacher', 'student', 'parent'), listTeachers);
router.get('/users', allowRoles('admin', 'teacher', 'student', 'parent', 'driver'), listUsers);
router.get('/users/:userId', allowRoles('admin', 'teacher', 'student', 'parent', 'driver'), getUser);

router.post('/assignments', allowRoles('teacher', 'admin'), upload.array('files', 5), validateRequest(createAssignmentSchema), createAssignment);
router.get('/assignments', allowRoles('student', 'teacher', 'admin', 'parent'), listAssignments);
router.post('/assignments/:assignmentId/submissions', allowRoles('student'), upload.array('files', 3), validateRequest(submitAssignmentSchema), submitAssignment);
router.patch('/submissions/:submissionId/grade', allowRoles('teacher', 'admin'), validateRequest(gradeSubmissionSchema), gradeSubmission);

router.post('/attendance', allowRoles('teacher', 'admin'), validateRequest(markAttendanceSchema), markAttendance);
router.get('/attendance/:studentId/report', allowRoles('student', 'teacher', 'admin', 'parent'), getAttendanceReport);

router.post('/announcements', allowRoles('teacher', 'admin'), validateRequest(createAnnouncementSchema), createAnnouncement);
router.get('/announcements', allowRoles('student', 'teacher', 'admin', 'parent'), listAnnouncements);

router.post('/marks', allowRoles('teacher', 'admin'), validateRequest(createMarkSchema), createMark);
router.get('/report-cards/:studentId', allowRoles('student', 'teacher', 'admin', 'parent'), getReportCard);
router.get('/leaderboard/:classId', allowRoles('student', 'teacher', 'admin'), getLeaderboard);

router.put('/timetables', allowRoles('admin', 'teacher'), validateRequest(saveTimetableSchema), saveTimetable);
router.get('/timetables', allowRoles('student', 'teacher', 'admin', 'parent'), getTimetable);
// ── Communities & Clubs ──
router.post('/clubs', allowRoles('student', 'teacher', 'admin'), createClub);
router.post('/clubs/:clubId/join', allowRoles('student', 'teacher', 'admin'), joinClub);
router.get('/clubs/:clubId/messages', allowRoles('student', 'teacher', 'admin'), getClubMessages);
router.post('/clubs/:clubId/messages', allowRoles('student', 'teacher', 'admin'), sendClubMessage);
router.post('/clubs/:clubId/research', allowRoles('student', 'teacher', 'admin'), upload.array('files', 1), uploadResearchPaper);
router.get('/clubs/leaderboard', allowRoles('student', 'teacher', 'admin'), getClubLeaderboard);

// ── Study Planner ──
router.post('/study-plans', allowRoles('student'), saveStudyPlan);
router.get('/study-plans', allowRoles('student'), getMyStudyPlans);

// ── Library ──
router.get('/library/books', allowRoles('admin', 'teacher', 'student', 'librarian', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const books = await getRecords('library_books');
  res.json({ success: true, books });
}));
router.post('/library/books', allowRoles('admin', 'librarian'), asyncHandler(async (req, res) => {
  const { updateRecord } = await import('../utils/firebaseDb.js');
  const id = `book-${Date.now()}`;
  const book = { id, ...req.body, createdAt: new Date().toISOString() };
  await updateRecord(`library_books/${id}`, book);
  res.status(201).json({ success: true, book });
}));
router.patch('/library/books/:bookId', allowRoles('admin', 'librarian'), asyncHandler(async (req, res) => {
  const { getRecord, updateRecord } = await import('../utils/firebaseDb.js');
  const existing = await getRecord(`library_books/${req.params.bookId}`);
  if (!existing) return res.status(404).json({ success: false, message: 'Book not found' });
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  await updateRecord(`library_books/${req.params.bookId}`, updated);
  res.json({ success: true, book: updated });
}));
router.delete('/library/books/:bookId', allowRoles('admin', 'librarian'), asyncHandler(async (req, res) => {
  const { deleteRecord } = await import('../utils/firebaseDb.js');
  await deleteRecord(`library_books/${req.params.bookId}`);
  res.json({ success: true });
}));
router.get('/library/transactions', allowRoles('admin', 'librarian', 'teacher', 'student', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const transactions = await getRecords('library_transactions');
  res.json({ success: true, transactions });
}));
router.post('/library/transactions', allowRoles('admin', 'librarian'), asyncHandler(async (req, res) => {
  const { updateRecord } = await import('../utils/firebaseDb.js');
  const id = `ltx-${Date.now()}`;
  const tx = { id, ...req.body, createdAt: new Date().toISOString() };
  await updateRecord(`library_transactions/${id}`, tx);
  res.status(201).json({ success: true, transaction: tx });
}));

// ── Maintenance Tickets ──
router.get('/maintenance', allowRoles('admin', 'teacher', 'student', 'librarian', 'driver', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const tickets = await getRecords('maintenance_tickets');
  res.json({ success: true, tickets });
}));
router.post('/maintenance', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { updateRecord } = await import('../utils/firebaseDb.js');
  const id = `mt-${Date.now()}`;
  const ticket = { id, ...req.body, createdBy: req.user.id, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await updateRecord(`maintenance_tickets/${id}`, ticket);
  res.status(201).json({ success: true, ticket });
}));
router.patch('/maintenance/:ticketId', allowRoles('admin'), asyncHandler(async (req, res) => {
  const { getRecord, updateRecord } = await import('../utils/firebaseDb.js');
  const existing = await getRecord(`maintenance_tickets/${req.params.ticketId}`);
  if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  await updateRecord(`maintenance_tickets/${req.params.ticketId}`, updated);
  res.json({ success: true, ticket: updated });
}));

// ── Social Posts ──
router.get('/social/posts', allowRoles('admin', 'teacher', 'student', 'librarian', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const posts = await getRecords('social_posts');
  res.json({ success: true, posts });
}));
router.post('/social/posts', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { updateRecord } = await import('../utils/firebaseDb.js');
  const id = `post-${Date.now()}`;
  const post = { id, ...req.body, authorId: req.user.id, createdAt: new Date().toISOString(), likes: [], comments: [], views: 0 };
  await updateRecord(`social_posts/${id}`, post);
  res.status(201).json({ success: true, post });
}));
router.patch('/social/posts/:postId', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { getRecord, updateRecord } = await import('../utils/firebaseDb.js');
  const existing = await getRecord(`social_posts/${req.params.postId}`);
  if (!existing) return res.status(404).json({ success: false, message: 'Post not found' });
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  await updateRecord(`social_posts/${req.params.postId}`, updated);
  res.json({ success: true, post: updated });
}));
router.delete('/social/posts/:postId', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { deleteRecord } = await import('../utils/firebaseDb.js');
  await deleteRecord(`social_posts/${req.params.postId}`);
  res.json({ success: true });
}));

// ── Social Groups ──
router.get('/social/groups', allowRoles('admin', 'teacher', 'student', 'librarian', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const groups = await getRecords('social_groups');
  res.json({ success: true, groups });
}));
router.post('/social/groups', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { updateRecord } = await import('../utils/firebaseDb.js');
  const id = `group-${Date.now()}`;
  const group = { id, ...req.body, createdBy: req.user.id, createdAt: new Date().toISOString(), members: [req.user.id] };
  await updateRecord(`social_groups/${id}`, group);
  res.status(201).json({ success: true, group });
}));
router.patch('/social/groups/:groupId', allowRoles('admin', 'teacher', 'student', 'librarian'), asyncHandler(async (req, res) => {
  const { getRecord, updateRecord } = await import('../utils/firebaseDb.js');
  const existing = await getRecord(`social_groups/${req.params.groupId}`);
  if (!existing) return res.status(404).json({ success: false, message: 'Group not found' });
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  await updateRecord(`social_groups/${req.params.groupId}`, updated);
  res.json({ success: true, group: updated });
}))

// ── Notes (student-accessible teacher notes) ──
router.get('/notes', allowRoles('student', 'teacher', 'admin', 'parent'), asyncHandler(async (req, res) => {
  const { getRecords } = await import('../utils/firebaseDb.js');
  const notes = await getRecords('class_notes');
  notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, notes: notes.slice(0, 100) });
}));
 
 export default router;
