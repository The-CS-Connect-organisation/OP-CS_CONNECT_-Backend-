import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord } from '../utils/firebaseDb.js';

// Grading scale
const GRADING_SCALE = {
  'A': { min: 90, max: 100 },
  'B': { min: 80, max: 89 },
  'C': { min: 70, max: 79 },
  'D': { min: 60, max: 69 },
  'F': { min: 0, max: 59 }
};

// Calculate percentage
const calculatePercentage = (marks, maxMarks) => {
  if (maxMarks <= 0) return 0;
  return Math.round((marks / maxMarks) * 100 * 100) / 100; // Round to 2 decimal places
};

// Assign grade based on percentage
const assignGrade = (percentage) => {
  for (const [grade, range] of Object.entries(GRADING_SCALE)) {
    if (percentage >= range.min && percentage <= range.max) {
      return grade;
    }
  }
  return 'F';
};

// Validate report card data
const validateReportCard = (data) => {
  const errors = [];

  if (!data.studentId) errors.push('studentId is required');
  if (!data.teacherId) errors.push('teacherId is required');
  if (!data.classId) errors.push('classId is required');
  if (!data.term) errors.push('term is required');
  if (!data.year) errors.push('year is required');
  if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
    errors.push('At least one subject is required');
  }

  // Validate each subject
  data.subjects?.forEach((subject, index) => {
    if (!subject.name || subject.name.trim() === '') {
      errors.push(`Subject ${index + 1}: name is required`);
    }
    if (subject.marksObtained === undefined || subject.marksObtained === null) {
      errors.push(`Subject ${index + 1}: marksObtained is required`);
    }
    if (subject.marksObtained < 0) {
      errors.push(`Subject ${index + 1}: marksObtained cannot be negative`);
    }
    if (subject.maxMarks === undefined || subject.maxMarks === null) {
      errors.push(`Subject ${index + 1}: maxMarks is required`);
    }
    if (subject.maxMarks <= 0) {
      errors.push(`Subject ${index + 1}: maxMarks must be positive`);
    }
    if (subject.marksObtained > subject.maxMarks) {
      errors.push(`Subject ${index + 1}: marksObtained cannot exceed maxMarks`);
    }
    if (subject.remarks && subject.remarks.length > 500) {
      errors.push(`Subject ${index + 1}: remarks cannot exceed 500 characters`);
    }
  });

  if (data.teacherRemarks && data.teacherRemarks.length > 1000) {
    errors.push('teacherRemarks cannot exceed 1000 characters');
  }

  return errors;
};

// ============================================================================
// CREATE REPORT CARD
// ============================================================================
export const createReportCard = asyncHandler(async (req, res) => {
  const { studentId, classId, term, year, subjects, teacherRemarks } = req.body;
  const teacherId = req.user.id;

  // Validate input
  const validationErrors = validateReportCard({
    studentId,
    teacherId,
    classId,
    term,
    year,
    subjects,
    teacherRemarks
  });

  if (validationErrors.length > 0) {
    throw new ApiError(400, 'Validation failed', validationErrors);
  }

  // Check for duplicate report card
  const existingCards = await queryRecords('report_cards', (card) =>
    card.student_id === studentId && card.term === term && card.year === year
  );

  if (existingCards.length > 0) {
    throw new ApiError(409, 'Report card already exists for this student in this term');
  }

  // Process subjects - calculate percentage and grade
  const processedSubjects = subjects.map((subject) => {
    const percentage = calculatePercentage(subject.marksObtained, subject.maxMarks);
    const grade = assignGrade(percentage);

    return {
      id: `${subject.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      name: subject.name,
      marksObtained: subject.marksObtained,
      maxMarks: subject.maxMarks,
      percentage: percentage,
      grade: grade,
      remarks: subject.remarks || ''
    };
  });

  // Calculate overall percentage and grade
  const totalMarks = processedSubjects.reduce((sum, s) => sum + s.marksObtained, 0);
  const totalMaxMarks = processedSubjects.reduce((sum, s) => sum + s.maxMarks, 0);
  const overallPercentage = calculatePercentage(totalMarks, totalMaxMarks);
  const overallGrade = assignGrade(overallPercentage);

  // Create report card
  const reportCardId = `rc_${studentId}_${term}_${year}_${Date.now()}`;
  const reportCard = {
    id: reportCardId,
    student_id: studentId,
    teacher_id: teacherId,
    class_id: classId,
    term: term,
    year: year,
    status: 'Draft',
    subjects: processedSubjects,
    overall_percentage: overallPercentage,
    overall_grade: overallGrade,
    teacher_remarks: teacherRemarks || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: teacherId,
    updated_by: teacherId,
    version_history: [
      {
        version: 1,
        timestamp: new Date().toISOString(),
        changes: 'Initial creation'
      }
    ]
  };

  await createRecord('report_cards', reportCardId, reportCard);

  res.status(201).json({
    success: true,
    message: 'Report card created successfully',
    data: reportCard
  });
});

// ============================================================================
// GET REPORT CARD BY ID
// ============================================================================
export const getReportCard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Report card ID is required');
  }

  const reportCard = await getRecord(`report_cards/${id}`);

  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  // Check authorization
  if (req.user.role === 'teacher' && reportCard.teacher_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this report card');
  }

  if (req.user.role === 'student' && reportCard.student_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this report card');
  }

  res.json({
    success: true,
    data: reportCard
  });
});

// ============================================================================
// UPDATE REPORT CARD
// ============================================================================
export const updateReportCard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subjects, teacherRemarks, status } = req.body;

  if (!id) {
    throw new ApiError(400, 'Report card ID is required');
  }

  const reportCard = await getRecord(`report_cards/${id}`);

  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  // Check authorization
  if (reportCard.teacher_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to update this report card');
  }

  // Validate input if subjects are being updated
  if (subjects) {
    const validationErrors = validateReportCard({
      studentId: reportCard.student_id,
      teacherId: reportCard.teacher_id,
      classId: reportCard.class_id,
      term: reportCard.term,
      year: reportCard.year,
      subjects,
      teacherRemarks: teacherRemarks || reportCard.teacher_remarks
    });

    if (validationErrors.length > 0) {
      throw new ApiError(400, 'Validation failed', validationErrors);
    }

    // Process subjects
    const processedSubjects = subjects.map((subject) => {
      const percentage = calculatePercentage(subject.marksObtained, subject.maxMarks);
      const grade = assignGrade(percentage);

      return {
        id: subject.id || `${subject.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        name: subject.name,
        marksObtained: subject.marksObtained,
        maxMarks: subject.maxMarks,
        percentage: percentage,
        grade: grade,
        remarks: subject.remarks || ''
      };
    });

    // Calculate overall percentage and grade
    const totalMarks = processedSubjects.reduce((sum, s) => sum + s.marksObtained, 0);
    const totalMaxMarks = processedSubjects.reduce((sum, s) => sum + s.maxMarks, 0);
    const overallPercentage = calculatePercentage(totalMarks, totalMaxMarks);
    const overallGrade = assignGrade(overallPercentage);

    reportCard.subjects = processedSubjects;
    reportCard.overall_percentage = overallPercentage;
    reportCard.overall_grade = overallGrade;
  }

  if (teacherRemarks !== undefined) {
    if (teacherRemarks.length > 1000) {
      throw new ApiError(400, 'teacherRemarks cannot exceed 1000 characters');
    }
    reportCard.teacher_remarks = teacherRemarks;
  }

  if (status) {
    if (!['Draft', 'Submitted', 'Reviewed'].includes(status)) {
      throw new ApiError(400, 'Invalid status. Must be Draft, Submitted, or Reviewed');
    }
    reportCard.status = status;
  }

  reportCard.updated_at = new Date().toISOString();
  reportCard.updated_by = req.user.id;

  // Add to version history
  if (!reportCard.version_history) {
    reportCard.version_history = [];
  }
  const nextVersion = (reportCard.version_history[reportCard.version_history.length - 1]?.version || 0) + 1;
  reportCard.version_history.push({
    version: nextVersion,
    timestamp: new Date().toISOString(),
    changes: 'Updated'
  });

  await updateRecord('report_cards', id, reportCard);

  res.json({
    success: true,
    message: 'Report card updated successfully',
    data: reportCard
  });
});

// ============================================================================
// DELETE REPORT CARD
// ============================================================================
export const deleteReportCard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Report card ID is required');
  }

  const reportCard = await getRecord(`report_cards/${id}`);

  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  // Check authorization
  if (reportCard.teacher_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to delete this report card');
  }

  await deleteRecord('report_cards', id);

  res.json({
    success: true,
    message: 'Report card deleted successfully'
  });
});

// ============================================================================
// LIST REPORT CARDS WITH FILTERING AND PAGINATION
// ============================================================================
export const listReportCards = asyncHandler(async (req, res) => {
  const { studentId, classId, term, year, status, page = 1, limit = 20 } = req.query;

  let reportCards = await getRecords('report_cards');

  // Apply filters
  if (studentId) {
    reportCards = reportCards.filter(card => card.student_id === studentId);
  }

  if (classId) {
    reportCards = reportCards.filter(card => card.class_id === classId);
  }

  if (term) {
    reportCards = reportCards.filter(card => card.term === term);
  }

  if (year) {
    reportCards = reportCards.filter(card => card.year === parseInt(year));
  }

  if (status) {
    reportCards = reportCards.filter(card => card.status === status);
  }

  // Authorization - teachers can only see their class's report cards
  if (req.user.role === 'teacher') {
    const teacherClasses = await queryRecords('classroom_teachers', (ct) =>
      ct.teacher_id === req.user.id
    );
    const classIds = teacherClasses.map(tc => tc.classroom_id);
    reportCards = reportCards.filter(card => classIds.includes(card.class_id));
  }

  // Authorization - students can only see their own report cards
  if (req.user.role === 'student') {
    reportCards = reportCards.filter(card => card.student_id === req.user.id);
  }

  // Pagination
  const { skip, limit: parsedLimit } = parsePagination(page, limit);
  const paginatedCards = reportCards.slice(skip, skip + parsedLimit);

  const response = buildPaginatedResponse(paginatedCards, reportCards.length, page, parsedLimit);

  res.json({
    success: true,
    ...response
  });
});

// ============================================================================
// SUBMIT REPORT CARD (Mark as Submitted)
// ============================================================================
export const submitReportCard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Report card ID is required');
  }

  const reportCard = await getRecord(`report_cards/${id}`);

  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  // Check authorization
  if (reportCard.teacher_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to submit this report card');
  }

  // Validate all required fields are present
  if (!reportCard.subjects || reportCard.subjects.length === 0) {
    throw new ApiError(400, 'Report card must have at least one subject');
  }

  reportCard.status = 'Submitted';
  reportCard.updated_at = new Date().toISOString();
  reportCard.updated_by = req.user.id;

  // Add to version history
  if (!reportCard.version_history) {
    reportCard.version_history = [];
  }
  const nextVersion = (reportCard.version_history[reportCard.version_history.length - 1]?.version || 0) + 1;
  reportCard.version_history.push({
    version: nextVersion,
    timestamp: new Date().toISOString(),
    changes: 'Submitted'
  });

  await updateRecord('report_cards', id, reportCard);

  res.json({
    success: true,
    message: 'Report card submitted successfully',
    data: reportCard
  });
});
