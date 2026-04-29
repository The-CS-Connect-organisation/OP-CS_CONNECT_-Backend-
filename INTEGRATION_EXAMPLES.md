# Teacher Productivity Suite - Integration Examples

## Complete Integration Examples

### Example 1: Real-time Attendance Marking with Notifications

```javascript
import { bulkMarkAttendance } from './controllers/teacherController.js';
import { emitToClass } from './utils/socket.js';
import { sendCustomNotification } from './services/notificationService.js';

// Mark attendance
export const markAttendanceWithNotifications = asyncHandler(async (req, res) => {
  const { classId, date, entries } = req.body;
  const teacherId = req.user.id;
  
  // Mark attendance
  const attendanceResult = await bulkMarkAttendance(req, res);
  
  // Emit real-time update
  emitToClass(classId, 'attendance:updated', {
    classId,
    date,
    markedBy: teacherId,
    timestamp: new Date().toISOString(),
  });
  
  // Send notification to students with low attendance
  const lowAttendanceStudents = entries.filter(e => e.status === 'absent');
  
  if (lowAttendanceStudents.length > 0) {
    await sendCustomNotification({
      type: 'attendance_alert',
      title: 'Attendance Marked',
      message: 'Your attendance has been marked for today',
      targetUsers: lowAttendanceStudents.map(e => e.studentId),
      classId,
    });
  }
  
  res.json({ success: true, message: 'Attendance marked and notifications sent' });
});
```

### Example 2: Bulk Grading with Productivity Score Update

```javascript
import { bulkGradeSubmissions } from './controllers/teacherController.js';
import { calculateProductivityScore } from './services/productivityScoreService.js';
import { emitToClass } from './utils/socket.js';

export const gradeSubmissionsAndUpdateScore = asyncHandler(async (req, res) => {
  const { assignmentId, grades } = req.body;
  const teacherId = req.user.id;
  
  // Grade submissions
  const gradingResult = await bulkGradeSubmissions(req, res);
  
  // Calculate updated productivity score
  const scoreResult = await calculateProductivityScore(teacherId);
  
  // Get assignment details
  const assignment = await getRecord(`assignments/${assignmentId}`);
  
  // Emit real-time updates
  emitToClass(assignment.class_id, 'submissions:graded', {
    assignmentId,
    count: grades.length,
    timestamp: new Date().toISOString(),
  });
  
  // Emit productivity score update
  emitToUser(teacherId, 'productivity:score_updated', {
    score: scoreResult.score,
    level: scoreResult.level,
    breakdown: scoreResult.breakdown,
  });
  
  res.json({
    success: true,
    graded: gradingResult.graded,
    productivityScore: scoreResult.score,
  });
});
```

### Example 3: Advanced Search with Filtering and Caching

```javascript
import { advancedSearch, filterStudents } from './services/advancedFilterService.js';
import { cacheMiddleware, CACHE_DURATIONS } from './middleware/cache.js';

// Route with caching
router.post('/search/advanced', cacheMiddleware(CACHE_DURATIONS.SHORT), async (req, res) => {
  const { searchTerm, filters } = req.body;
  
  // Perform advanced search
  const searchResult = await advancedSearch(searchTerm, ['students', 'assignments']);
  
  // Apply additional filters
  if (filters?.students) {
    const studentFilter = await filterStudents({
      ...filters.students,
      searchTerm, // Include search term in filter
    });
    
    searchResult.results.students = studentFilter.students;
  }
  
  res.json({
    success: true,
    results: searchResult.results,
    totalResults: searchResult.totalResults,
    cached: true,
  });
});
```

### Example 4: Scheduled Notifications with Recurring Pattern

```javascript
import { scheduleNotificationWithPattern } from './services/scheduledNotificationService.js';
import { processScheduledNotifications } from './services/scheduledNotificationService.js';

// Schedule daily assignment reminders
export const scheduleAssignmentReminders = async (classId, assignmentTitle) => {
  const notification = {
    id: `reminder_${Date.now()}`,
    type: 'assignment_reminder',
    title: `Reminder: ${assignmentTitle}`,
    message: `Don't forget to submit your assignment: ${assignmentTitle}`,
    class_id: classId,
  };
  
  // Schedule for 1 hour before deadline
  const result = await scheduleNotificationWithPattern(notification, {
    type: 'daily',
    hour: 14, // 2 PM
    minute: 0,
  });
  
  return result;
};

// Process scheduled notifications (run periodically)
export const processNotifications = async () => {
  const result = await processScheduledNotifications();
  console.log(`Processed ${result.processed} notifications`);
};
```

### Example 5: Message Delivery Tracking with Real-time Status

```javascript
import { markMessageAsDelivered, markMessageAsRead } from './services/messageDeliveryService.js';
import { emitToUser } from './utils/socket.js';

// WebSocket handler for message delivery
io.on('connection', (socket) => {
  socket.on('message:delivered', async (data) => {
    const { messageId, recipientId, senderId } = data;
    
    // Mark as delivered
    const result = await markMessageAsDelivered(messageId, recipientId);
    
    // Emit status update to sender
    emitToUser(senderId, 'message:status_updated', {
      messageId,
      recipientId,
      status: 'delivered',
      timestamp: result.deliveredAt,
    });
  });
  
  socket.on('message:read', async (data) => {
    const { messageId, recipientId, senderId } = data;
    
    // Mark as read
    const result = await markMessageAsRead(messageId, recipientId);
    
    // Emit status update to sender
    emitToUser(senderId, 'message:status_updated', {
      messageId,
      recipientId,
      status: 'read',
      timestamp: result.readAt,
    });
  });
});
```

### Example 6: Keyboard Shortcut Tracking with Analytics

```javascript
import { trackShortcutUsage, getShortcutUsageStats } from './services/keyboardShortcutService.js';

// Track shortcut usage
export const trackShortcut = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { action } = req.params;
  
  // Track usage
  await trackShortcutUsage(userId, action);
  
  // Get updated stats
  const stats = await getShortcutUsageStats(userId, 7);
  
  res.json({
    success: true,
    tracked: action,
    stats: stats.stats,
  });
});

// Get shortcut recommendations
export const getShortcutRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const { getShortcutRecommendations } = await import('./services/keyboardShortcutService.js');
  
  const result = await getShortcutRecommendations(userId);
  
  res.json({
    success: true,
    recommendations: result.recommendations,
    message: result.message,
  });
});
```

### Example 7: Productivity Dashboard with All Features

```javascript
import { getTeacherDashboard } from './controllers/teacherController.js';
import { calculateProductivityScore } from './services/productivityScoreService.js';
import { getShortcutUsageStats } from './services/keyboardShortcutService.js';
import { cacheMiddleware, CACHE_DURATIONS } from './middleware/cache.js';

// Enhanced dashboard with all features
router.get('/dashboard/enhanced', cacheMiddleware(CACHE_DURATIONS.MEDIUM), asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  
  // Get base dashboard
  const dashboardResult = await getTeacherDashboard(req, res);
  
  // Get productivity score
  const scoreResult = await calculateProductivityScore(teacherId);
  
  // Get shortcut stats
  const shortcutStats = await getShortcutUsageStats(teacherId, 7);
  
  res.json({
    success: true,
    dashboard: dashboardResult.dashboard,
    productivity: {
      score: scoreResult.score,
      level: scoreResult.level,
      breakdown: scoreResult.breakdown,
    },
    shortcuts: {
      mostUsed: shortcutStats.mostUsed,
      totalUsage: shortcutStats.totalUsage,
    },
  });
}));
```

### Example 8: Complete Workflow - From Submission to Notification

```javascript
import { bulkGradeSubmissions } from './controllers/teacherController.js';
import { markMessageAsRead } from './services/messageDeliveryService.js';
import { sendCustomNotification } from './services/notificationService.js';
import { calculateProductivityScore } from './services/productivityScoreService.js';
import { emitToClass, emitToUser } from './utils/socket.js';

export const completeGradingWorkflow = asyncHandler(async (req, res) => {
  const { assignmentId, grades } = req.body;
  const teacherId = req.user.id;
  
  // Step 1: Grade submissions
  const gradingResult = await bulkGradeSubmissions(req, res);
  
  // Step 2: Get assignment details
  const assignment = await getRecord(`assignments/${assignmentId}`);
  
  // Step 3: Send notifications to students
  const notifications = [];
  for (const grade of grades) {
    const submission = await getRecord(`submissions/${grade.submissionId}`);
    
    const notification = {
      id: `grade_${grade.submissionId}`,
      type: 'grade_posted',
      title: 'Your assignment has been graded',
      message: `Your grade for ${assignment.title}: ${grade.marks}/${assignment.max_points}`,
      target_users: [submission.student_id],
    };
    
    await sendCustomNotification(notification);
    notifications.push(notification);
    
    // Emit real-time notification
    emitToUser(submission.student_id, 'notification:new', notification);
  }
  
  // Step 4: Update productivity score
  const scoreResult = await calculateProductivityScore(teacherId);
  
  // Step 5: Emit class-wide update
  emitToClass(assignment.class_id, 'submissions:graded', {
    assignmentId,
    count: grades.length,
    timestamp: new Date().toISOString(),
  });
  
  // Step 6: Emit teacher update
  emitToUser(teacherId, 'productivity:updated', {
    score: scoreResult.score,
    level: scoreResult.level,
  });
  
  res.json({
    success: true,
    graded: gradingResult.graded,
    notificationsSent: notifications.length,
    productivityScore: scoreResult.score,
  });
});
```

### Example 9: Rate-Limited Bulk Operations

```javascript
import { attendanceLimiter, gradingLimiter } from './middleware/rateLimiter.js';
import { bulkMarkAttendance } from './controllers/teacherController.js';

// Apply rate limiting to bulk operations
router.post('/attendance/mark', attendanceLimiter, asyncHandler(async (req, res) => {
  const { classId, date, entries } = req.body;
  
  // Check if within rate limit
  if (entries.length > 100) {
    throw new ApiError(429, 'Too many entries in single request. Max 100 per request.');
  }
  
  // Process attendance
  const result = await bulkMarkAttendance(req, res);
  
  res.json({
    success: true,
    processed: entries.length,
    ...result,
  });
}));
```

### Example 10: Security-Enhanced Endpoint

```javascript
import { sanitizeInput } from './middleware/sanitizer.js';
import { messagingLimiter } from './middleware/rateLimiter.js';
import { validateRequest } from './middleware/validateRequest.js';
import { sendQuickMessageSchema } from './validators/teacherValidators.js';

// Secure message endpoint
router.post(
  '/messages/quick',
  sanitizeInput,
  messagingLimiter,
  validateRequest(sendQuickMessageSchema),
  asyncHandler(async (req, res) => {
    const { recipientId, classId, content } = req.body;
    const senderId = req.user.id;
    
    // Input is already sanitized by middleware
    const message = {
      id: Date.now().toString(),
      sender_id: senderId,
      recipient_id: recipientId,
      class_id: classId,
      content, // Already sanitized
      created_at: new Date().toISOString(),
    };
    
    await updateRecord(`messages/${message.id}`, message);
    
    // Emit real-time message
    if (recipientId) {
      emitToUser(recipientId, 'message:new', message);
    }
    
    res.status(201).json({ success: true, message });
  })
);
```

## Testing Examples

### Test Productivity Score
```bash
curl -X GET http://localhost:3000/api/teacher/productivity/score \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Advanced Search
```bash
curl -X POST http://localhost:3000/api/teacher/search/advanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "John",
    "collections": ["students", "assignments"],
    "filters": {
      "students": {
        "grade": "10",
        "minAttendance": 75
      }
    }
  }'
```

### Test Keyboard Shortcuts
```bash
curl -X GET http://localhost:3000/api/teacher/shortcuts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Message Delivery Status
```bash
curl -X GET http://localhost:3000/api/teacher/messages/msg_123/delivery-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Rate Limiting
```bash
# This will hit the rate limit after 50 requests in 1 minute
for i in {1..60}; do
  curl -X POST http://localhost:3000/api/teacher/attendance/mark \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"classId":"class_1","date":"2024-01-01","entries":[]}'
done
```

## Performance Optimization Tips

1. **Use Caching**
   - Cache GET requests with appropriate durations
   - Invalidate cache on mutations

2. **Batch Operations**
   - Combine multiple operations into single requests
   - Use bulk endpoints when available

3. **Real-time Updates**
   - Use WebSocket for live data instead of polling
   - Reduces server load by ~60%

4. **Rate Limiting**
   - Prevents abuse and ensures fair usage
   - Adjust limits based on actual usage patterns

5. **Database Optimization**
   - Use indexes on frequently queried fields
   - Optimize query patterns

---

**Last Updated:** 2024
**Version:** 1.0
