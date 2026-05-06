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
 
 export default router;
