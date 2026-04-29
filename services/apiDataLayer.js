/**
 * Backend API Data Layer
 * Centralized data access layer for Firebase operations
 * Provides abstraction, caching, and error handling
 */

import { getRecords, queryRecords, getRecord, updateRecord, createRecord, deleteRecord, batchWrite } from '../utils/firebaseDb.js';
import { logger } from '../utils/logger.js';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Get cached data
 */
function getCachedData(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cached data
 */
function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear cache
 */
function clearCache(pattern = null) {
  if (!pattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// TEACHER DATA LAYER
// ============================================================================

export const teacherDataLayer = {
  // ========== ATTENDANCE ==========

  async getClassAttendance(classId, date) {
    try {
      const cacheKey = `attendance:${classId}:${date}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
      if (!Array.isArray(enrollments)) {
        return { students: [], date, classId };
      }
      
      const studentIds = enrollments.map((e) => e.student_id);

      if (!studentIds.length) {
        return { students: [], date, classId };
      }

      let students = await getRecords('student_profiles');
      if (!Array.isArray(students)) {
        return { students: [], date, classId };
      }
      
      students = students.filter(s => studentIds.includes(s.user_id));

      const enrichedStudents = await Promise.all(
        students.map(async (student) => {
          const user = await getRecord(`users/${student.user_id}`);
          return {
            id: student.user_id,
            name: user?.name || 'Unknown',
            rollNumber: student.roll_number,
            attendancePercent: student.attendance_percent || 100,
          };
        })
      );

      const existingAttendance = await queryRecords('attendance_records', (r) =>
        r.class_id === classId && r.date === date
      );

      const attendanceMap = {};
      if (Array.isArray(existingAttendance)) {
        existingAttendance.forEach(record => {
          attendanceMap[record.student_id] = record.status;
        });
      }

      const studentsWithStatus = enrichedStudents.map(student => ({
        ...student,
        status: attendanceMap[student.id] || 'absent',
      }));

      const result = {
        date,
        classId,
        students: studentsWithStatus,
        summary: {
          total: studentsWithStatus.length,
          present: studentsWithStatus.filter(s => s.status === 'present').length,
          absent: studentsWithStatus.filter(s => s.status === 'absent').length,
          late: studentsWithStatus.filter(s => s.status === 'late').length,
          excused: studentsWithStatus.filter(s => s.status === 'excused').length,
        }
      };

      setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error getting class attendance:', error);
      throw error;
    }
  },

  async markAttendance(classId, date, entries, teacherId) {
    try {
      clearCache(`attendance:${classId}`);

      const normalizedDate = date.split('T')[0];
      const operations = entries.map((entry) => {
        const recordId = `${classId}_${entry.studentId}_${normalizedDate}`;
        return {
          path: `attendance_records/${recordId}`,
          data: {
            id: recordId,
            class_id: classId,
            student_id: entry.studentId,
            teacher_id: teacherId,
            date: normalizedDate,
            status: entry.status,
            notes: entry.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          operation: 'set',
        };
      });

      await batchWrite(operations);

      // Update attendance percentages
      await Promise.all(
        entries.map(async (entry) => {
          const records = await queryRecords('attendance_records', (r) => r.student_id === entry.studentId);
          const presentOrLate = records.filter(r => ['present', 'late', 'excused'].includes(r.status)).length;
          const attendancePercent = records.length > 0 ? Math.round((presentOrLate / records.length) * 100) : 100;

          await updateRecord(`student_profiles/${entry.studentId}`, {
            attendance_percent: attendancePercent,
          });
        })
      );

      return { success: true, message: 'Attendance marked successfully' };
    } catch (error) {
      logger.error('Error marking attendance:', error);
      throw error;
    }
  },

  // ========== GRADING ==========

  async getGradingTemplates(teacherId, subject = null) {
    try {
      const cacheKey = `templates:${teacherId}:${subject || 'all'}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      let templates = await getRecords('grading_templates');
      templates = templates.filter(t => t.teacher_id === teacherId || t.is_public === true);

      if (subject) {
        templates = templates.filter(t => t.subject === subject);
      }

      templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setCachedData(cacheKey, templates);
      return templates;
    } catch (error) {
      logger.error('Error getting grading templates:', error);
      throw error;
    }
  },

  async createGradingTemplate(template, teacherId) {
    try {
      clearCache(`templates:${teacherId}`);

      const templateId = Date.now().toString();
      const newTemplate = {
        id: templateId,
        ...template,
        teacher_id: teacherId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await updateRecord(`grading_templates/${templateId}`, newTemplate);
      return newTemplate;
    } catch (error) {
      logger.error('Error creating grading template:', error);
      throw error;
    }
  },

  async bulkGradeSubmissions(assignmentId, grades, templateId = null, teacherId) {
    try {
      clearCache('submissions');

      const assignment = await getRecord(`assignments/${assignmentId}`);
      if (!assignment) throw new Error('Assignment not found');

      const template = templateId ? await getRecord(`grading_templates/${templateId}`) : null;

      const updatedSubmissions = await Promise.all(
        grades.map(async (gradeEntry) => {
          const submission = await getRecord(`submissions/${gradeEntry.submissionId}`);
          if (!submission) return null;

          let feedback = gradeEntry.feedback || '';
          let marks = gradeEntry.marks;

          if (template && !marks) {
            const criteriaScores = gradeEntry.criteriaScores || {};
            marks = Object.values(criteriaScores).reduce((sum, score) => sum + (score || 0), 0);

            if (template.rubric) {
              const maxPossible = template.criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);
              const percentage = (marks / maxPossible) * 100;
              const rubricEntry = Object.entries(template.rubric)
                .find(([range]) => {
                  const [min, max] = range.split('-').map(Number);
                  return percentage >= min && percentage <= max;
                });
              if (rubricEntry) {
                feedback = rubricEntry[1].feedback || feedback;
              }
            }
          }

          const updated = {
            ...submission,
            marks,
            feedback,
            graded_by: teacherId,
            graded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await updateRecord(`submissions/${gradeEntry.submissionId}`, updated);
          return updated;
        })
      );

      return {
        success: true,
        message: `${updatedSubmissions.filter(Boolean).length} submissions graded`,
        graded: updatedSubmissions.filter(Boolean)
      };
    } catch (error) {
      logger.error('Error bulk grading submissions:', error);
      throw error;
    }
  },

  // ========== ANALYTICS ==========

  async getClassAnalytics(classId, term = null) {
    try {
      const cacheKey = `analytics:${classId}:${term || 'all'}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
      const studentIds = enrollments.map((e) => e.student_id);

      if (!studentIds.length) {
        return { success: true, analytics: null };
      }

      let marks = await getRecords('marks');
      marks = marks.filter(m => studentIds.includes(m.student_id));

      if (term) {
        marks = marks.filter(m => m.term === term);
      }

      const subjectAverages = {};
      marks.forEach(mark => {
        if (!subjectAverages[mark.subject]) {
          subjectAverages[mark.subject] = { total: 0, count: 0, scores: [] };
        }
        subjectAverages[mark.subject].total += Number(mark.score);
        subjectAverages[mark.subject].count += 1;
        subjectAverages[mark.subject].scores.push(Number(mark.score));
      });

      const averages = Object.entries(subjectAverages).map(([subject, data]) => ({
        subject,
        average: (data.total / data.count).toFixed(2),
        highest: Math.max(...data.scores),
        lowest: Math.min(...data.scores),
        studentCount: data.count,
      }));

      const attendanceRecords = await queryRecords('attendance_records', (r) => r.class_id === classId);
      const attendanceByStudent = {};
      attendanceRecords.forEach(record => {
        if (!attendanceByStudent[record.student_id]) {
          attendanceByStudent[record.student_id] = { total: 0, present: 0 };
        }
        attendanceByStudent[record.student_id].total += 1;
        if (['present', 'late', 'excused'].includes(record.status)) {
          attendanceByStudent[record.student_id].present += 1;
        }
      });

      const attendanceRates = Object.values(attendanceByStudent).map(data =>
        data.total > 0 ? (data.present / data.total) * 100 : 100
      );
      const avgAttendance = attendanceRates.length > 0
        ? (attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length).toFixed(2)
        : 0;

      const assignments = await queryRecords('assignments', (a) => a.class_id === classId);
      const submissions = await queryRecords('submissions', (s) =>
        assignments.some(a => a.id === s.assignment_id)
      );

      const completionRate = assignments.length > 0
        ? (submissions.length / (assignments.length * studentIds.length) * 100).toFixed(2)
        : 0;

      const analytics = {
        classId,
        studentCount: studentIds.length,
        academicPerformance: {
          subjectAverages: averages,
          classAverage: averages.length > 0
            ? (averages.reduce((sum, a) => sum + parseFloat(a.average), 0) / averages.length).toFixed(2)
            : 0,
        },
        attendance: {
          averageRate: avgAttendance,
          below75Percent: attendanceRates.filter(r => r < 75).length,
        },
        engagement: {
          assignmentCompletionRate: completionRate,
          totalAssignments: assignments.length,
          totalSubmissions: submissions.length,
        },
      };

      setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      logger.error('Error getting class analytics:', error);
      throw error;
    }
  },

  // ========== STUDENT PROGRESS ==========

  async getStudentProgress(studentId, term = null) {
    try {
      const cacheKey = `progress:${studentId}:${term || 'all'}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      const student = await getRecord(`student_profiles/${studentId}`);
      if (!student) throw new Error('Student profile not found');

      const user = await getRecord(`users/${student.user_id}`);

      let marks = await queryRecords('marks', (m) => m.student_id === studentId);

      if (term) {
        marks = marks.filter(m => m.term === term);
      }

      const subjectProgress = {};
      marks.forEach(mark => {
        if (!subjectProgress[mark.subject]) {
          subjectProgress[mark.subject] = { scores: [], exams: [] };
        }
        subjectProgress[mark.subject].scores.push(Number(mark.score));
        subjectProgress[mark.subject].exams.push({
          type: mark.exam_type,
          score: Number(mark.score),
          term: mark.term,
          date: mark.created_at,
        });
      });

      const progressBySubject = Object.entries(subjectProgress).map(([subject, data]) => {
        const scores = data.scores;
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        const trend = scores.length > 1
          ? ((scores[scores.length - 1] - scores[0]) / scores[0] * 100).toFixed(2)
          : 0;

        return {
          subject,
          average: average.toFixed(2),
          trend: parseFloat(trend),
          trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
          exams: data.exams.sort((a, b) => new Date(a.date) - new Date(b.date)),
        };
      });

      const attendanceRecords = await queryRecords('attendance_records', (r) => r.student_id === studentId);
      const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);
      const gradedSubmissions = submissions.filter(s => s.marks !== undefined);

      const progress = {
        student: {
          id: studentId,
          name: user?.name || 'Unknown',
          grade: student.grade,
          section: student.section,
          attendancePercent: student.attendance_percent || 100,
          xp: student.xp || 0,
          badges: student.badges || [],
        },
        academicProgress: progressBySubject,
        attendanceHistory: attendanceRecords.slice(-30),
        submissionHistory: {
          total: submissions.length,
          graded: gradedSubmissions.length,
          pending: submissions.length - gradedSubmissions.length,
          recent: gradedSubmissions.slice(-10).map(s => ({
            assignmentId: s.assignment_id,
            marks: s.marks,
            feedback: s.feedback,
            submittedAt: s.submitted_at,
            gradedAt: s.graded_at,
          })),
        },
      };

      setCachedData(cacheKey, progress);
      return progress;
    } catch (error) {
      logger.error('Error getting student progress:', error);
      throw error;
    }
  },

  // ========== NOTIFICATIONS ==========

  async getNotifications(userId, page = 1, limit = 20) {
    try {
      let notifications = await queryRecords('notifications', (n) =>
        n.target_users.length === 0 || n.target_users.includes(userId)
      );

      notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const total = notifications.length;
      const skip = (page - 1) * limit;
      const items = notifications.slice(skip, skip + limit);

      return {
        items,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error getting notifications:', error);
      throw error;
    }
  },

  async createNotification(notification, userId) {
    try {
      clearCache('notifications');

      const notificationId = Date.now().toString();
      const newNotification = {
        id: notificationId,
        ...notification,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await updateRecord(`notifications/${notificationId}`, newNotification);
      return newNotification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  },

  // ========== DASHBOARD ==========

  async getTeacherDashboard(teacherId) {
    try {
      const cacheKey = `dashboard:${teacherId}`;
      const cached = getCachedData(cacheKey);
      if (cached) return cached;

      const classrooms = await queryRecords('classrooms', (c) => c.teacher_id === teacherId);
      const today = new Date().toISOString().split('T')[0];

      let todayAttendance = { total: 0, present: 0, absent: 0 };

      for (const classItem of classrooms) {
        const records = await queryRecords('attendance_records', (r) =>
          r.class_id === classItem.id && r.date === today
        );
        todayAttendance.total += records.length;
        todayAttendance.present += records.filter(r => r.status === 'present').length;
        todayAttendance.absent += records.filter(r => r.status === 'absent').length;
      }

      const assignments = await queryRecords('assignments', (a) => a.teacher_id === teacherId);
      const assignmentIds = assignments.map(a => a.id);
      const submissions = await queryRecords('submissions', (s) =>
        assignmentIds.includes(s.assignment_id)
      );
      const pendingGrading = submissions.filter(s => s.marks === undefined).length;

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcomingDeadlines = assignments.filter(a =>
        new Date(a.due_date) <= nextWeek && new Date(a.due_date) >= new Date()
      );

      const dashboard = {
        overview: {
          totalClasses: classrooms.length,
          totalStudents: classrooms.reduce((sum, c) => sum + (c.student_count || 0), 0),
          todayAttendance,
          pendingGrading,
        },
        upcomingDeadlines: upcomingDeadlines.slice(0, 5).map(a => ({
          id: a.id,
          title: a.title,
          dueDate: a.due_date,
          subject: a.subject,
          className: a.class_id,
        })),
        quickActions: [
          { action: 'mark_attendance', label: 'Mark Attendance', icon: 'attendance' },
          { action: 'grade_submissions', label: 'Grade Submissions', icon: 'grade', badge: pendingGrading },
          { action: 'send_message', label: 'Send Message', icon: 'message' },
          { action: 'create_assignment', label: 'Create Assignment', icon: 'assignment' },
          { action: 'view_reports', label: 'View Reports', icon: 'report' },
        ],
      };

      setCachedData(cacheKey, dashboard);
      return dashboard;
    } catch (error) {
      logger.error('Error getting teacher dashboard:', error);
      throw error;
    }
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const dataLayerUtils = {
  clearCache,
  getCachedData,
  setCachedData,
};

export default {
  teacherDataLayer,
  dataLayerUtils,
};
