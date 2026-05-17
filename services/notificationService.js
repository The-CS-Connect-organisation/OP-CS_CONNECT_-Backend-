/**
 * Notification Service
 * Handles automated notifications for the teacher productivity suite
 */

import { getRecords, queryRecords, updateRecord } from '../utils/firebaseDb.js';
import { emitToUser } from '../utils/socket.js';
import { logger } from '../utils/logger.js';
import { generateId } from '../utils/generateId.js';

/**
 * Check for upcoming assignment deadlines
 * @param {number} hoursBefore - Hours before deadline to send notification
 */
export const checkUpcomingDeadlines = async (hoursBefore = 24) => {
  try {
    const now = new Date();
    const deadlineWindow = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    
    const assignments = await getRecords('assignments');
    if (!Array.isArray(assignments)) {
      return { count: 0, notifications: [] };
    }
    
    const upcomingDeadlines = assignments.filter(a => {
      const dueDate = new Date(a.due_date);
      return dueDate > now && dueDate <= deadlineWindow;
    });
    
    if (upcomingDeadlines.length === 0) {
      return { count: 0, notifications: [] };
    }
    
    const notifications = [];
    
    for (const assignment of upcomingDeadlines) {
      // Get students in the class
      const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === assignment.class_id);
      if (!Array.isArray(enrollments)) continue;
      
      const studentIds = enrollments.map(e => e.student_id);
      
      // Check if notification already sent for this assignment
      const existingNotification = await queryRecords('notifications', (n) => 
        n.type === 'assignment_due' && n.class_id === assignment.class_id
      );
      
      const alreadyNotified = Array.isArray(existingNotification) && existingNotification.some(n => {
        const assignmentIds = n.metadata?.assignmentIds || [];
        return assignmentIds.includes(assignment.id);
      });
      
      if (!alreadyNotified && studentIds.length > 0) {
        const notificationId = generateId();
        const notification = {
          id: notificationId,
          type: 'assignment_due',
          title: `Assignment Due: ${assignment.title}`,
          message: `Your assignment "${assignment.title}" is due on ${new Date(assignment.due_date).toLocaleDateString()}.`,
          target_users: studentIds,
          class_id: assignment.class_id,
          metadata: {
            assignmentId: assignment.id,
            assignmentIds: [assignment.id],
            dueDate: assignment.due_date,
          },
          sent_at: new Date().toISOString(),
          read_by: [],
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await updateRecord(`notifications/${notificationId}`, notification);
        notifications.push(notification);
        
        // Emit real-time notification to students
        studentIds.forEach(studentId => {
          emitToUser(studentId, 'notification:new', notification);
        });
      }
    }
    
    logger.info(`Checked upcoming deadlines: ${notifications.length} notifications sent`);
    return { count: notifications.length, notifications };
  } catch (error) {
    logger.error('Error checking upcoming deadlines', { error: error.message });
    return { count: 0, notifications: [], error: error.message };
  }
};

/**
 * Check for students with low attendance
 * @param {number} threshold - Attendance percentage threshold
 */
export const checkLowAttendance = async (threshold = 75) => {
  try {
    const students = await getRecords('student_profiles');
    if (!Array.isArray(students)) {
      return { count: 0, notifications: [] };
    }
    
    const lowAttendanceStudents = students.filter(s => 
      (s.attendance_percent || 100) < threshold
    );
    
    if (lowAttendanceStudents.length === 0) {
      return { count: 0, notifications: [] };
    }
    
    const notifications = [];
    
    for (const student of lowAttendanceStudents) {
      // Check if notification already sent recently (within 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const existingNotifications = await queryRecords('notifications', (n) => 
        n.type === 'low_attendance' && 
        n.target_users?.includes(student.user_id) &&
        n.created_at > weekAgo.toISOString()
      );
      
      if (!Array.isArray(existingNotifications) || existingNotifications.length === 0) {
        const notificationId = generateId();
        const notification = {
          id: notificationId,
          type: 'low_attendance',
          title: 'Low Attendance Alert',
          message: `Student attendance is below ${threshold}%. Current attendance: ${student.attendance_percent || 0}%`,
          target_users: [student.user_id],
          metadata: {
            studentId: student.user_id,
            attendancePercent: student.attendance_percent,
            threshold,
          },
          sent_at: new Date().toISOString(),
          read_by: [],
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await updateRecord(`notifications/${notificationId}`, notification);
        notifications.push(notification);
        
        // Emit real-time notification
        emitToUser(student.user_id, 'notification:new', notification);
      }
    }
    
    logger.info(`Checked low attendance: ${notifications.length} notifications sent`);
    return { count: notifications.length, notifications };
  } catch (error) {
    logger.error('Error checking low attendance', { error: error.message });
    return { count: 0, notifications: [], error: error.message };
  }
};

/**
 * Check for students with poor performance
 * @param {number} failingScore - Score threshold for failing
 */
export const checkPoorPerformance = async (failingScore = 45) => {
  try {
    const marks = await getRecords('marks');
    if (!Array.isArray(marks)) {
      return { count: 0, notifications: [] };
    }
    
    const failingMarks = marks.filter(m => Number(m.score) < failingScore);
    
    // Group by student
    const studentFailingMarks = {};
    failingMarks.forEach(mark => {
      if (!studentFailingMarks[mark.student_id]) {
        studentFailingMarks[mark.student_id] = [];
      }
      studentFailingMarks[mark.student_id].push(mark);
    });
    
    if (Object.keys(studentFailingMarks).length === 0) {
      return { count: 0, notifications: [] };
    }
    
    const notifications = [];
    
    for (const [studentId, marks] of Object.entries(studentFailingMarks)) {
      // Check if notification already sent recently
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const existingNotifications = await queryRecords('notifications', (n) => 
        n.type === 'poor_performance' && 
        n.target_users?.includes(studentId) &&
        n.created_at > weekAgo.toISOString()
      );
      
      if (!Array.isArray(existingNotifications) || existingNotifications.length === 0) {
        const subjects = [...new Set(marks.map(m => m.subject))];
        
        const notificationId = generateId();
        const notification = {
          id: notificationId,
          type: 'poor_performance',
          title: 'Performance Alert',
          message: `Student has ${marks.length} failing marks in: ${subjects.join(', ')}`,
          target_users: [studentId],
          metadata: {
            studentId,
            failingMarks: marks.length,
            subjects,
            failingScore,
          },
          sent_at: new Date().toISOString(),
          read_by: [],
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await updateRecord(`notifications/${notificationId}`, notification);
        notifications.push(notification);
        
        // Emit real-time notification
        emitToUser(studentId, 'notification:new', notification);
      }
    }
    
    logger.info(`Checked poor performance: ${notifications.length} notifications sent`);
    return { count: notifications.length, notifications };
  } catch (error) {
    logger.error('Error checking poor performance', { error: error.message });
    return { count: 0, notifications: [], error: error.message };
  }
};

/**
 * Run all automated notification checks
 * This should be called periodically (e.g., every hour)
 */
export const runAutomatedNotificationChecks = async () => {
  logger.info('Running automated notification checks...');
  
  const results = {
    deadlines: await checkUpcomingDeadlines(24),
    attendance: await checkLowAttendance(75),
    performance: await checkPoorPerformance(45),
  };
  
  const totalNotifications = results.deadlines.count + results.attendance.count + results.performance.count;
  logger.info(`Automated notification checks completed: ${totalNotifications} notifications sent`);
  
  return results;
};

/**
 * Send a custom notification
 */
export const sendCustomNotification = async (data) => {
  try {
    const notificationId = generateId();
    const notification = {
      id: notificationId,
      type: data.type || 'custom',
      title: data.title,
      message: data.message,
      target_users: data.targetUsers || [],
      class_id: data.classId || null,
      metadata: data.metadata || {},
      scheduled_at: data.scheduledAt || null,
      sent_at: null,
      read_by: [],
      created_by: data.createdBy || 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await updateRecord(`notifications/${notificationId}`, notification);
    
    // If not scheduled, send immediately
    if (!data.scheduledAt) {
      await updateRecord(`notifications/${notificationId}`, {
        sent_at: new Date().toISOString(),
      });
      
      // Determine target users
      let targetUserIds = data.targetUsers || [];
      if (targetUserIds.length === 0 && data.classId) {
        const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === data.classId);
        targetUserIds = enrollments.map(e => e.student_id);
      }
      
      // Emit to each target user
      targetUserIds.forEach(userId => {
        emitToUser(userId, 'notification:new', notification);
      });
    }
    
    return { success: true, notification };
  } catch (error) {
    logger.error('Error sending custom notification', { error: error.message });
    return { success: false, error: error.message };
  }
};

export default {
  checkUpcomingDeadlines,
  checkLowAttendance,
  checkPoorPerformance,
  runAutomatedNotificationChecks,
  sendCustomNotification,
};