import { z } from 'zod';

const uuidField = z.string().uuid('Invalid UUID');

export const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const createClassSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(40),
    grade: z.string().trim().min(1).max(20),
    section: z.string().trim().min(1).max(20),
    privacyLeaderboardEnabled: z.boolean().optional(),
  }),
});

export const createStudentProfileSchema = z.object({
  body: z.object({
    userId: uuidField,
    grade: z.string().trim().min(1).max(20),
    section: z.string().trim().min(1).max(20),
    rollNumber: z.string().trim().min(1).max(30),
    subjects: z.array(z.string().trim().min(1).max(100)).min(1),
    parentName: z.string().trim().max(100).optional(),
    parentPhone: z.string().trim().max(40).optional(),
  }),
});

export const createTeacherProfileSchema = z.object({
  body: z.object({
    userId: uuidField,
    subjects: z.array(z.string().trim().min(1).max(100)).min(1),
    phone: z.string().trim().max(40).optional(),
  }),
});

export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(5).max(5000),
    subject: z.string().trim().min(2).max(100),
    classId: uuidField,
    dueDate: z.string().datetime(),
    maxMarks: z.number().int().min(1).max(1000),
  }),
});

export const submitAssignmentSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1).max(10000).optional(),
  }),
  params: z.object({
    assignmentId: uuidField,
  }),
});

export const gradeSubmissionSchema = z.object({
  body: z.object({
    marks: z.number().min(0).max(1000),
    feedback: z.string().trim().max(5000).optional(),
  }),
  params: z.object({
    submissionId: uuidField,
  }),
});

export const markAttendanceSchema = z.object({
  body: z.object({
    classId: uuidField,
    date: z.string().datetime(),
    entries: z
      .array(
        z.object({
          studentId: uuidField,
          status: z.enum(['present', 'absent', 'late']),
        })
      )
      .min(1),
  }),
});

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200),
    body: z.string().trim().min(2).max(5000),
    category: z.enum(['exam', 'holiday', 'event', 'emergency']),
    scope: z.enum(['school', 'class']),
    classId: uuidField.optional(),
    pinned: z.boolean().optional(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    recipientId: uuidField.optional(),
    classId: uuidField.optional(),
    content: z.string().trim().min(1).max(5000),
  }),
});

export const createMarkSchema = z.object({
  body: z.object({
    studentId: uuidField,
    classId: uuidField,
    subject: z.string().trim().min(2).max(100),
    examType: z.enum(['unit_test', 'mid_term', 'final']),
    score: z.number().min(0).max(100),
    term: z.string().trim().min(1).max(50),
  }),
});

export const saveTimetableSchema = z.object({
  body: z.object({
    classId: uuidField,
    entries: z
      .array(
        z.object({
          day: z.string().trim().min(3).max(20),
          period: z.number().int().min(1).max(12),
          subject: z.string().trim().min(2).max(100),
          teacherId: uuidField,
          room: z.string().trim().min(1).max(50),
        })
      )
      .min(1),
  }),
});
