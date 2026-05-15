import { Router } from 'express';
import pkgMulter from 'multer';
const multer = pkgMulter.default || pkgMulter;
import {
  // Attendance
  getClassAttendanceView,
  bulkMarkAttendance,
  // Grading Templates
  createGradingTemplate,
  getGradingTemplates,
  bulkGradeSubmissions,
  // Class Performance Analytics
  getClassPerformanceAnalytics,
  getClassTrends,
  // Student Progress Tracking
  getStudentProgress,
  getStudentProgressTimeline,
  // Notifications
  createNotification,
  getMyNotifications,
  getUnreadNotificationCount,
  checkAutomatedNotifications,
  // Class Notes
  createClassNote,
  getClassNotes,
  updateClassNote,
  deleteClassNote,
  // Message Templates & Quick Messaging
  getMessageTemplates,
  createMessageTemplate,
  sendQuickMessage,
  // Performance Reports
  generateClassReport,
  generateStudentReport,
  // Productivity Dashboard
  getTeacherDashboard,
  // Data Export
  exportAttendanceData,
  exportGradesData,
  exportStudentList,
  // Productivity Insights
  getProductivityInsights,
  // New endpoints
  getProductivityScore,
  getMessageDeliveryStatus,
  getAdvancedFilterOptions,
  performAdvancedSearch,
  getKeyboardShortcuts,
  updateKeyboardShortcut,
  trackKeyboardShortcut,
  getShortcutStats,
  // AI-powered features
  analyzeAttendanceAI,
  identifyLearningGapsAI,
  predictPerformanceAI,
  recommendAssignmentAI,
  generateClassInsightsAI,
  generateFeedbackAI,
} from '../controllers/teacherController.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  bulkMarkAttendanceSchema,
  createGradingTemplateSchema,
  bulkGradeSubmissionsSchema,
  createClassNoteSchema,
  updateClassNoteSchema,
  createMessageTemplateSchema,
  sendQuickMessageSchema,
  createNotificationSchema,
  exportDataSchema,
} from '../validators/teacherValidators.js';
import {
  attendanceLimiter,
  gradingLimiter,
  messagingLimiter,
  exportLimiter,
} from '../middleware/rateLimiter.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Apply authentication to all teacher routes
router.use(requireAuth);
router.use(allowRoles('teacher', 'admin'));

// ============================================================================
// PRODUCTIVITY DASHBOARD
// ============================================================================
router.get('/dashboard', getTeacherDashboard);

// ============================================================================
// QUICK ATTENDANCE MARKING
// ============================================================================
router.get('/attendance/class/:classId', cacheMiddleware(), getClassAttendanceView);
router.post(
  '/attendance/mark',
  attendanceLimiter,
  validateRequest(bulkMarkAttendanceSchema),
  bulkMarkAttendance
);

// ============================================================================
// BULK GRADING
// ============================================================================
router.post(
  '/grading/templates',
  validateRequest(createGradingTemplateSchema),
  createGradingTemplate
);
router.get('/grading/templates', cacheMiddleware(), getGradingTemplates);
router.post(
  '/grading/bulk',
  gradingLimiter,
  validateRequest(bulkGradeSubmissionsSchema),
  bulkGradeSubmissions
);

// ============================================================================
// CLASS PERFORMANCE ANALYTICS
// ============================================================================
router.get('/analytics/class/:classId', getClassPerformanceAnalytics);
router.get('/analytics/class/:classId/trends', getClassTrends);

// ============================================================================
// STUDENT PROGRESS TRACKING
// ============================================================================
router.get('/progress/student/:studentId', getStudentProgress);
router.get('/progress/student/:studentId/timeline', getStudentProgressTimeline);

// ============================================================================
// AUTOMATED NOTIFICATIONS
// ============================================================================
router.post(
  '/notifications',
  validateRequest(createNotificationSchema),
  createNotification
);
router.get('/notifications', getMyNotifications);
router.get('/notifications/unread-count', getUnreadNotificationCount);
router.get('/notifications/check', checkAutomatedNotifications);

// ============================================================================
// CLASS NOTES ORGANIZATION
// ============================================================================
router.post(
  '/notes',
  upload.array('files', 5),
  validateRequest(createClassNoteSchema),
  createClassNote
);
router.get('/notes/class/:classId', getClassNotes);
router.put(
  '/notes/:noteId',
  upload.array('files', 5),
  validateRequest(updateClassNoteSchema),
  updateClassNote
);
router.delete('/notes/:noteId', deleteClassNote);

// ============================================================================
// QUICK MESSAGING WITH TEMPLATES
// ============================================================================
router.post(
  '/message-templates',
  validateRequest(createMessageTemplateSchema),
  createMessageTemplate
);
router.get('/message-templates', cacheMiddleware(), getMessageTemplates);
router.post(
  '/messages/quick',
  messagingLimiter,
  validateRequest(sendQuickMessageSchema),
  sendQuickMessage
);

// ============================================================================
// PERFORMANCE REPORTS
// ============================================================================
router.get('/reports/class/:classId', generateClassReport);
router.get('/reports/student/:studentId', generateStudentReport);

// ============================================================================
// DATA EXPORT & INTEGRATION
// ============================================================================
router.get(
  '/export/attendance',
  exportLimiter,
  validateRequest(exportDataSchema),
  exportAttendanceData
);
router.get(
  '/export/grades',
  exportLimiter,
  validateRequest(exportDataSchema),
  exportGradesData
);
router.get(
  '/export/students',
  exportLimiter,
  validateRequest(exportDataSchema),
  exportStudentList
);

// ============================================================================
// PRODUCTIVITY INSIGHTS (AI-DRIVEN)
// ============================================================================
router.get('/insights', getProductivityInsights);

// ============================================================================
// PRODUCTIVITY SCORE
// ============================================================================
router.get('/productivity/score', getProductivityScore);

// ============================================================================
// MESSAGE DELIVERY STATUS
// ============================================================================
router.get('/messages/:messageId/delivery-status', getMessageDeliveryStatus);

// ============================================================================
// ADVANCED FILTERING & SEARCH
// ============================================================================
router.get('/filter/options', getAdvancedFilterOptions);
router.post('/search/advanced', performAdvancedSearch);

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
router.get('/shortcuts', getKeyboardShortcuts);
router.put('/shortcuts/:action', updateKeyboardShortcut);
router.post('/shortcuts/:action/track', trackKeyboardShortcut);
router.get('/shortcuts/stats', getShortcutStats);

// ============================================================================
// AI-POWERED FEATURES
router.get('/ai/attendance-analysis/:studentId', analyzeAttendanceAI);
router.get('/ai/learning-gaps/:studentId', identifyLearningGapsAI);
router.get('/ai/performance-prediction/:studentId', predictPerformanceAI);
router.get('/ai/assignment-recommendation/:classId', recommendAssignmentAI);
router.get('/ai/class-insights/:classId', generateClassInsightsAI);
router.post('/ai/generate-feedback', generateFeedbackAI);

// Supply Analytics & Bulk Notifications
import { getSupplyAnalytics, getStudentSupplyAlerts, sendBulkParentNotification } from '../controllers/teacherController.js';
router.get('/supply-analytics', getSupplyAnalytics);
router.get('/student-supply-alerts', getStudentSupplyAlerts);
router.post('/send-bulk-notification', validateRequest(createNotificationSchema), sendBulkParentNotification);

export default router;