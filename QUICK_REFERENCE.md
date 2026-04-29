# Teacher Productivity Suite - Quick Reference Guide

## 🚀 Quick Start

### Import Services
```javascript
// Scheduled Notifications
import { scheduleNotification, processScheduledNotifications } from './services/scheduledNotificationService.js';

// Message Delivery
import { markMessageAsRead, getMessageDeliveryStatus } from './services/messageDeliveryService.js';

// Productivity Score
import { calculateProductivityScore } from './services/productivityScoreService.js';

// Advanced Filtering
import { filterStudents, advancedSearch } from './services/advancedFilterService.js';

// Keyboard Shortcuts
import { trackShortcutUsage, getShortcutUsageStats } from './services/keyboardShortcutService.js';

// WebSocket
import { emitToUser, emitToClass, isUserOnline } from './utils/socket.js';
```

## 📊 Common Operations

### Real-time Attendance Update
```javascript
import { emitToClass } from './utils/socket.js';

emitToClass(classId, 'attendance:updated', {
  classId,
  studentId,
  status: 'present',
  timestamp: new Date().toISOString(),
});
```

### Schedule a Notification
```javascript
import { scheduleNotification } from './services/scheduledNotificationService.js';

const delayMs = 24 * 60 * 60 * 1000; // 24 hours
await scheduleNotification(notification, delayMs);
```

### Track Message as Read
```javascript
import { markMessageAsRead } from './services/messageDeliveryService.js';

await markMessageAsRead(messageId, recipientId);
```

### Calculate Productivity Score
```javascript
import { calculateProductivityScore } from './services/productivityScoreService.js';

const result = await calculateProductivityScore(teacherId);
console.log(`Score: ${result.score}, Level: ${result.level}`);
```

### Filter Students
```javascript
import { filterStudents } from './services/advancedFilterService.js';

const result = await filterStudents({
  grade: '10',
  minAttendance: 75,
  searchTerm: 'John',
  sortBy: 'name',
  sortOrder: 'asc',
});
```

### Track Keyboard Shortcut
```javascript
import { trackShortcutUsage } from './services/keyboardShortcutService.js';

await trackShortcutUsage(userId, 'attendance:mark_present');
```

## 🔌 WebSocket Events

### Emit to User
```javascript
import { emitToUser } from './utils/socket.js';

emitToUser(userId, 'notification:new', {
  id: notificationId,
  title: 'New Assignment',
  message: 'Assignment due tomorrow',
});
```

### Emit to Class
```javascript
import { emitToClass } from './utils/socket.js';

emitToClass(classId, 'grade:updated', {
  submissionId,
  marks: 85,
  feedback: 'Great work!',
});
```

### Check if User Online
```javascript
import { isUserOnline } from './utils/socket.js';

if (isUserOnline(userId)) {
  // Send real-time notification
}
```

## 🛡️ Security

### Sanitize Input
```javascript
import { sanitizeInput } from './middleware/sanitizer.js';

app.use(sanitizeInput);
```

### Apply Rate Limiting
```javascript
import { attendanceLimiter } from './middleware/rateLimiter.js';

router.post('/attendance/mark', attendanceLimiter, handler);
```

### Cache GET Requests
```javascript
import { cacheMiddleware, CACHE_DURATIONS } from './middleware/cache.js';

router.get('/data', cacheMiddleware(CACHE_DURATIONS.MEDIUM), handler);
```

## 📈 Productivity Score Breakdown

| Component | Max Points | Calculation |
|-----------|-----------|------------|
| Attendance Marking | 20 | Records marked / 100 |
| Grading Timeliness | 25 | Days to grade (ideal: 3 days) |
| Communication | 20 | Messages sent / 20 |
| Class Notes | 15 | Notes created / 10 |
| Analytics Usage | 10 | Fixed (placeholder) |
| Student Engagement | 10 | Submissions / 50 |

## 🎯 Message Delivery Statuses

```javascript
MESSAGE_STATUS = {
  SENDING: 'sending',      // Being sent
  SENT: 'sent',            // Sent to server
  DELIVERED: 'delivered',  // Delivered to recipient
  READ: 'read',            // Read by recipient
  FAILED: 'failed',        // Delivery failed
}
```

## ⌨️ Default Keyboard Shortcuts

### Attendance
- `a + p` - Mark present
- `a + a` - Mark absent
- `a + l` - Mark late
- `↑` - Previous student
- `↓` - Next student
- `ctrl + s` - Save

### Grading
- `→` - Next submission
- `←` - Previous submission
- `ctrl + s` - Save grade
- `ctrl + f` - Add feedback
- `ctrl + t` - Apply template

### Messaging
- `ctrl + Enter` - Send message
- `Escape` - Close composer
- `ctrl + m` - New message

### General
- `ctrl + f` - Search
- `?` - Show help
- `ctrl + h` - Go to dashboard

## 📡 API Endpoints

### Productivity
```
GET /api/teacher/productivity/score
```

### Messages
```
GET /api/teacher/messages/:messageId/delivery-status
```

### Filtering
```
GET /api/teacher/filter/options?collection=students
POST /api/teacher/search/advanced
```

### Shortcuts
```
GET /api/teacher/shortcuts
PUT /api/teacher/shortcuts/:action
POST /api/teacher/shortcuts/:action/track
GET /api/teacher/shortcuts/stats
```

## 🔄 Scheduled Notification Patterns

### Daily
```javascript
{
  type: 'daily',
  hour: 9,
  minute: 0,
}
```

### Weekly
```javascript
{
  type: 'weekly',
  dayOfWeek: 1, // Monday
  hour: 9,
  minute: 0,
}
```

### Monthly
```javascript
{
  type: 'monthly',
  dayOfMonth: 1,
  hour: 9,
  minute: 0,
}
```

## 💾 Cache Durations

```javascript
CACHE_DURATIONS = {
  SHORT: 5 * 60 * 1000,           // 5 minutes
  MEDIUM: 15 * 60 * 1000,         // 15 minutes
  LONG: 60 * 60 * 1000,           // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
}
```

## 🚦 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 300 | 15 min |
| Authentication | 20 | 15 min |
| Attendance | 50 | 1 min |
| Grading | 100 | 1 min |
| Messaging | 30 | 1 min |
| Export | 10 | 1 hour |

## 🔍 Filter Examples

### Filter Students
```javascript
{
  grade: '10',
  section: 'A',
  minAttendance: 75,
  maxAttendance: 100,
  performanceLevel: 'high',
  enrollmentStatus: 'active',
  searchTerm: 'John',
  sortBy: 'name',
  sortOrder: 'asc',
}
```

### Filter Submissions
```javascript
{
  assignmentId: 'assign_123',
  studentId: 'student_456',
  status: 'pending', // or 'graded', 'late'
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  minGrade: 50,
  maxGrade: 100,
  searchTerm: 'feedback',
  sortBy: 'submitted_at',
  sortOrder: 'desc',
}
```

### Filter Attendance
```javascript
{
  classId: 'class_123',
  studentId: 'student_456',
  status: 'absent', // or 'present', 'late', 'excused'
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  teacherId: 'teacher_789',
  sortBy: 'date',
  sortOrder: 'desc',
}
```

## 📚 Documentation Files

- `IMPLEMENTATION_GUIDE.md` - Detailed implementation guide
- `COMPLETION_SUMMARY.md` - Project completion summary
- `QUICK_REFERENCE.md` - This file

## 🆘 Troubleshooting

### WebSocket Not Connecting
1. Check CORS configuration in `app.js`
2. Verify Socket.IO is initialized
3. Check browser console for errors

### Cache Not Working
1. Verify middleware is applied to route
2. Check cache duration settings
3. Clear cache: `clearCache()`

### Rate Limiting Too Strict
1. Adjust limits in `middleware/rateLimiter.js`
2. Check if user is admin (admins skip limits)
3. Verify correct limiter is applied

### Notifications Not Sending
1. Check notification service is running
2. Verify user is online for real-time
3. Check scheduled notification jobs

## 📞 Support

For detailed information, refer to:
- `IMPLEMENTATION_GUIDE.md` - Full implementation details
- `COMPLETION_SUMMARY.md` - Project overview
- Individual service files - Code documentation

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** Production Ready ✅
