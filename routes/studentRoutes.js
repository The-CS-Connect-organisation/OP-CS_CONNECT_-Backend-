import { Router } from 'express';
import {
  getStudentProfile,
  updateStudentProfile,
  getStudentDashboard,
  getStudentGrades,
  getStudentAttendance,
  getStudentAssignments,
  getStudentNotifications,
  getStudentTimetable,
  getStudentAlerts,
} from '../controllers/studentController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.use(requireAuth);
router.use(allowRoles('student', 'parent', 'admin'));

// Profile
router.get('/profile', cacheMiddleware(), getStudentProfile);
router.put('/profile', updateStudentProfile);

// Dashboard
router.get('/dashboard', getStudentDashboard);

// Grades
router.get('/grades', cacheMiddleware(), getStudentGrades);

// Attendance
router.get('/attendance', cacheMiddleware(), getStudentAttendance);

// Assignments
router.get('/assignments', cacheMiddleware(), getStudentAssignments);

// Notifications
router.get('/notifications', getStudentNotifications);

// Supply Alerts
router.get('/supply-alerts', getStudentAlerts);

// Timetable
router.get('/timetable', cacheMiddleware(), getStudentTimetable);

export default router;
