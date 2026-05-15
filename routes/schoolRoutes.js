import { Router } from 'express';
import pkgMulter from 'multer';
const multer = pkgMulter.default || pkgMulter;
import {
  createAnnouncement,
  createAssignment,
  createAssignmentWithSupplies,
  updateAssignmentSupplies,
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
  // New feature controllers
  analyzeBookLoad,
  sendBookHeavyAlert,
  createFridgeItem,
  getFridgeItems,
  updateFridgeItem,
  deleteFridgeItem,
  createUniformSchedule,
  getUniformSchedule,
  getTodaysUniform,
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
  con