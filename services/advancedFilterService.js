/**
 * Advanced Filtering Service
 * Provides advanced search and filtering capabilities
 */

import { getRecords, queryRecords } from '../utils/firebaseDb.js';
import { logger } from '../utils/logger.js';

/**
 * Filter students by multiple criteria
 */
export const filterStudents = async (criteria) => {
  try {
    let students = await getRecords('student_profiles');
    
    // Filter by grade
    if (criteria.grade) {
      students = students.filter(s => s.grade === criteria.grade);
    }
    
    // Filter by section
    if (criteria.section) {
      students = students.filter(s => s.section === criteria.section);
    }
    
    // Filter by attendance range
    if (criteria.minAttendance !== undefined) {
      students = students.filter(s => (s.attendance_percent || 100) >= criteria.minAttendance);
    }
    
    if (criteria.maxAttendance !== undefined) {
      students = students.filter(s => (s.attendance_percent || 100) <= criteria.maxAttendance);
    }
    
    // Filter by performance
    if (criteria.performanceLevel) {
      // This would require calculating performance for each student
      // For now, we'll filter by XP as a proxy
      const xpThresholds = {
        'low': 0,
        'medium': 100,
        'high': 500,
      };
      const threshold = xpThresholds[criteria.performanceLevel] || 0;
      students = students.filter(s => (s.xp || 0) >= threshold);
    }
    
    // Filter by enrollment status
    if (criteria.enrollmentStatus) {
      students = students.filter(s => s.enrollment_status === criteria.enrollmentStatus);
    }
    
    // Search by name
    if (criteria.searchTerm) {
      const term = criteria.searchTerm.toLowerCase();
      students = students.filter(s => {
        const name = s.name?.toLowerCase() || '';
        const rollNumber = s.roll_number?.toString() || '';
        return name.includes(term) || rollNumber.includes(term);
      });
    }
    
    // Sort results
    if (criteria.sortBy) {
      students = sortResults(students, criteria.sortBy, criteria.sortOrder);
    }
    
    return {
      success: true,
      count: students.length,
      students,
    };
  } catch (error) {
    logger.error('Error filtering students', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Filter submissions by multiple criteria
 */
export const filterSubmissions = async (criteria) => {
  try {
    let submissions = await getRecords('submissions');
    
    // Filter by assignment
    if (criteria.assignmentId) {
      submissions = submissions.filter(s => s.assignment_id === criteria.assignmentId);
    }
    
    // Filter by student
    if (criteria.studentId) {
      submissions = submissions.filter(s => s.student_id === criteria.studentId);
    }
    
    // Filter by status
    if (criteria.status) {
      if (criteria.status === 'graded') {
        submissions = submissions.filter(s => s.marks !== undefined);
      } else if (criteria.status === 'pending') {
        submissions = submissions.filter(s => s.marks === undefined);
      } else if (criteria.status === 'late') {
        submissions = submissions.filter(s => s.is_late === true);
      }
    }
    
    // Filter by date range
    if (criteria.startDate) {
      submissions = submissions.filter(s => new Date(s.submitted_at) >= new Date(criteria.startDate));
    }
    
    if (criteria.endDate) {
      submissions = submissions.filter(s => new Date(s.submitted_at) <= new Date(criteria.endDate));
    }
    
    // Filter by grade range
    if (criteria.minGrade !== undefined) {
      submissions = submissions.filter(s => (s.marks || 0) >= criteria.minGrade);
    }
    
    if (criteria.maxGrade !== undefined) {
      submissions = submissions.filter(s => (s.marks || 0) <= criteria.maxGrade);
    }
    
    // Search by feedback
    if (criteria.searchTerm) {
      const term = criteria.searchTerm.toLowerCase();
      submissions = submissions.filter(s => 
        (s.feedback || '').toLowerCase().includes(term)
      );
    }
    
    // Sort results
    if (criteria.sortBy) {
      submissions = sortResults(submissions, criteria.sortBy, criteria.sortOrder);
    }
    
    return {
      success: true,
      count: submissions.length,
      submissions,
    };
  } catch (error) {
    logger.error('Error filtering submissions', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Filter attendance records by multiple criteria
 */
export const filterAttendance = async (criteria) => {
  try {
    let records = await getRecords('attendance_records');
    
    // Filter by class
    if (criteria.classId) {
      records = records.filter(r => r.class_id === criteria.classId);
    }
    
    // Filter by student
    if (criteria.studentId) {
      records = records.filter(r => r.student_id === criteria.studentId);
    }
    
    // Filter by status
    if (criteria.status) {
      records = records.filter(r => r.status === criteria.status);
    }
    
    // Filter by date range
    if (criteria.startDate) {
      records = records.filter(r => r.date >= criteria.startDate);
    }
    
    if (criteria.endDate) {
      records = records.filter(r => r.date <= criteria.endDate);
    }
    
    // Filter by teacher
    if (criteria.teacherId) {
      records = records.filter(r => r.teacher_id === criteria.teacherId);
    }
    
    // Sort results
    if (criteria.sortBy) {
      records = sortResults(records, criteria.sortBy, criteria.sortOrder);
    }
    
    return {
      success: true,
      count: records.length,
      records,
    };
  } catch (error) {
    logger.error('Error filtering attendance', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Advanced search across multiple collections
 */
export const advancedSearch = async (searchTerm, collections = ['students', 'assignments', 'notes']) => {
  try {
    const results = {};
    const term = searchTerm.toLowerCase();
    
    if (collections.includes('students')) {
      const students = await getRecords('student_profiles');
      results.students = students.filter(s => 
        (s.name || '').toLowerCase().includes(term) ||
        (s.roll_number || '').toString().includes(term)
      );
    }
    
    if (collections.includes('assignments')) {
      const assignments = await getRecords('assignments');
      results.assignments = assignments.filter(a => 
        (a.title || '').toLowerCase().includes(term) ||
        (a.description || '').toLowerCase().includes(term)
      );
    }
    
    if (collections.includes('notes')) {
      const notes = await getRecords('class_notes');
      results.notes = notes.filter(n => 
        (n.title || '').toLowerCase().includes(term) ||
        (n.content || '').toLowerCase().includes(term) ||
        (n.tags || []).some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    if (collections.includes('messages')) {
      const messages = await getRecords('messages');
      results.messages = messages.filter(m => 
        (m.content || '').toLowerCase().includes(term)
      );
    }
    
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    
    return {
      success: true,
      searchTerm,
      totalResults,
      results,
    };
  } catch (error) {
    logger.error('Error performing advanced search', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get filter suggestions based on data
 */
export const getFilterSuggestions = async (collection) => {
  try {
    const data = await getRecords(collection);
    const suggestions = {};
    
    if (collection === 'student_profiles') {
      suggestions.grades = [...new Set(data.map(s => s.grade).filter(Boolean))];
      suggestions.sections = [...new Set(data.map(s => s.section).filter(Boolean))];
      suggestions.performanceLevels = ['low', 'medium', 'high'];
    }
    
    if (collection === 'submissions') {
      suggestions.statuses = ['pending', 'graded', 'late'];
    }
    
    if (collection === 'attendance_records') {
      suggestions.statuses = ['present', 'absent', 'late', 'excused'];
    }
    
    if (collection === 'class_notes') {
      suggestions.categories = [...new Set(data.map(n => n.category).filter(Boolean))];
      suggestions.tags = [...new Set(data.flatMap(n => n.tags || []))];
    }
    
    return {
      success: true,
      collection,
      suggestions,
    };
  } catch (error) {
    logger.error('Error getting filter suggestions', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to sort results
 */
const sortResults = (items, sortBy, sortOrder = 'asc') => {
  const sorted = [...items];
  
  sorted.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Handle nested properties
    if (sortBy.includes('.')) {
      const keys = sortBy.split('.');
      aVal = keys.reduce((obj, key) => obj?.[key], a);
      bVal = keys.reduce((obj, key) => obj?.[key], b);
    }
    
    // Handle dates
    if (aVal instanceof Date || bVal instanceof Date) {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    // Handle numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Handle strings
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  });
  
  return sorted;
};

export default {
  filterStudents,
  filterSubmissions,
  filterAttendance,
  advancedSearch,
  getFilterSuggestions,
};
