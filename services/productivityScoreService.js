/**
 * Productivity Score Service
 * Calculates teacher productivity metrics and scores
 */

import { getRecords, queryRecords, updateRecord } from '../utils/firebaseDb.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate productivity score for a teacher
 * Score ranges from 0-100
 */
export const calculateProductivityScore = async (teacherId) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get teacher's data
    const classrooms = await queryRecords('classrooms', (c) => c.teacher_id === teacherId);
    const classIds = classrooms.map(c => c.id);
    
    if (classIds.length === 0) {
      return { success: true, score: 0, breakdown: {} };
    }
    
    // 1. Attendance Marking Score (20 points max)
    const attendanceRecords = await queryRecords('attendance_records', (r) => 
      classIds.includes(r.class_id) && new Date(r.created_at) >= weekAgo
    );
    const attendanceScore = Math.min(20, (attendanceRecords.length / 100) * 20);
    
    // 2. Grading Timeliness Score (25 points max)
    const assignments = await queryRecords('assignments', (a) => a.teacher_id === teacherId);
    const assignmentIds = assignments.map(a => a.id);
    const submissions = await queryRecords('submissions', (s) => 
      assignmentIds.includes(s.assignment_id) && new Date(s.submitted_at) >= monthAgo
    );
    
    const gradedSubmissions = submissions.filter(s => s.graded_at);
    const gradingTimeliness = gradedSubmissions.map(s => {
      const submittedDate = new Date(s.submitted_at);
      const gradedDate = new Date(s.graded_at);
      const daysToGrade = (gradedDate - submittedDate) / (1000 * 60 * 60 * 24);
      
      // Ideal: grade within 3 days
      if (daysToGrade <= 3) return 1;
      if (daysToGrade <= 7) return 0.7;
      if (daysToGrade <= 14) return 0.4;
      return 0;
    });
    
    const gradingScore = gradedSubmissions.length > 0
      ? (gradingTimeliness.reduce((a, b) => a + b, 0) / gradedSubmissions.length) * 25
      : 0;
    
    // 3. Communication Score (20 points max)
    const messages = await queryRecords('messages', (m) => 
      m.sender_id === teacherId && new Date(m.created_at) >= weekAgo
    );
    const communicationScore = Math.min(20, (messages.length / 20) * 20);
    
    // 4. Class Notes Organization Score (15 points max)
    const classNotes = await queryRecords('class_notes', (n) => 
      classIds.includes(n.class_id) && new Date(n.created_at) >= monthAgo
    );
    const notesScore = Math.min(15, (classNotes.length / 10) * 15);
    
    // 5. Analytics Usage Score (10 points max)
    // This would track how often the teacher views analytics
    // For now, we'll give points based on having viewed analytics
    const analyticsScore = 10; // Placeholder
    
    // 6. Student Engagement Score (10 points max)
    const studentEngagement = submissions.length > 0
      ? Math.min(10, (submissions.length / 50) * 10)
      : 0;
    
    const totalScore = Math.round(
      attendanceScore + gradingScore + communicationScore + notesScore + analyticsScore + studentEngagement
    );
    
    const breakdown = {
      attendance: Math.round(attendanceScore),
      grading: Math.round(gradingScore),
      communication: Math.round(communicationScore),
      notes: Math.round(notesScore),
      analytics: Math.round(analyticsScore),
      engagement: Math.round(studentEngagement),
    };
    
    // Determine productivity level
    let level = 'Low';
    if (totalScore >= 80) level = 'Excellent';
    else if (totalScore >= 60) level = 'Good';
    else if (totalScore >= 40) level = 'Average';
    
    // Save score to database
    const scoreRecord = {
      teacher_id: teacherId,
      score: totalScore,
      level,
      breakdown,
      calculated_at: new Date().toISOString(),
      period: 'weekly',
    };
    
    await updateRecord(`productivity_scores/${teacherId}_${Date.now()}`, scoreRecord);
    
    logger.info(`Productivity score calculated for teacher ${teacherId}: ${totalScore}`);
    
    return {
      success: true,
      score: totalScore,
      level,
      breakdown,
      metrics: {
        attendanceRecords: attendanceRecords.length,
        submissionsGraded: gradedSubmissions.length,
        messagesSent: messages.length,
        classNotesCreated: classNotes.length,
      }
    };
  } catch (error) {
    logger.error('Error calculating productivity score', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get productivity score history for a teacher
 */
export const getProductivityScoreHistory = async (teacherId, limit = 12) => {
  try {
    const scores = await queryRecords('productivity_scores', (s) => s.teacher_id === teacherId);
    
    // Sort by calculated_at descending and limit
    scores.sort((a, b) => new Date(b.calculated_at) - new Date(a.calculated_at));
    const history = scores.slice(0, limit);
    
    return {
      success: true,
      history,
      trend: calculateTrend(history),
    };
  } catch (error) {
    logger.error('Error getting productivity score history', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Calculate trend from score history
 */
const calculateTrend = (scores) => {
  if (scores.length < 2) return 'stable';
  
  const recent = scores[0].score;
  const previous = scores[1].score;
  const difference = recent - previous;
  
  if (difference > 5) return 'improving';
  if (difference < -5) return 'declining';
  return 'stable';
};

/**
 * Get productivity recommendations based on score
 */
export const getProductivityRecommendations = async (teacherId) => {
  try {
    const scoreResult = await calculateProductivityScore(teacherId);
    
    if (!scoreResult.success) {
      return { success: false, error: scoreResult.error };
    }
    
    const { breakdown } = scoreResult;
    const recommendations = [];
    
    // Generate recommendations based on weak areas
    if (breakdown.attendance < 10) {
      recommendations.push({
        priority: 'high',
        area: 'Attendance Marking',
        suggestion: 'Mark attendance more regularly. Try using the Quick Attendance tool daily.',
        impact: 'Improves student accountability and class management',
      });
    }
    
    if (breakdown.grading < 15) {
      recommendations.push({
        priority: 'high',
        area: 'Grading Timeliness',
        suggestion: 'Grade submissions faster. Use bulk grading templates to save time.',
        impact: 'Provides timely feedback to students',
      });
    }
    
    if (breakdown.communication < 10) {
      recommendations.push({
        priority: 'medium',
        area: 'Communication',
        suggestion: 'Send more messages to students. Use message templates for efficiency.',
        impact: 'Improves student-teacher communication',
      });
    }
    
    if (breakdown.notes < 8) {
      recommendations.push({
        priority: 'medium',
        area: 'Class Notes',
        suggestion: 'Organize and share more class notes. Create templates for reuse.',
        impact: 'Helps students access learning materials',
      });
    }
    
    if (breakdown.engagement < 5) {
      recommendations.push({
        priority: 'low',
        area: 'Student Engagement',
        suggestion: 'Create more assignments and encourage submissions.',
        impact: 'Increases student participation',
      });
    }
    
    return {
      success: true,
      recommendations,
      nextSteps: recommendations.filter(r => r.priority === 'high').map(r => r.suggestion),
    };
  } catch (error) {
    logger.error('Error getting productivity recommendations', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Compare productivity scores across teachers
 */
export const compareTeacherProductivity = async (teacherIds) => {
  try {
    const scores = await Promise.all(
      teacherIds.map(async (teacherId) => {
        const result = await calculateProductivityScore(teacherId);
        return {
          teacherId,
          score: result.score,
          level: result.level,
          breakdown: result.breakdown,
        };
      })
    );
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    const average = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
    
    return {
      success: true,
      scores,
      average,
      topPerformer: scores[0],
      needsSupport: scores[scores.length - 1],
    };
  } catch (error) {
    logger.error('Error comparing teacher productivity', { error: error.message });
    return { success: false, error: error.message };
  }
};

export default {
  calculateProductivityScore,
  getProductivityScoreHistory,
  getProductivityRecommendations,
  compareTeacherProductivity,
};
