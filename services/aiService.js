/**
 * AI Service Layer
 * Integrates with OpenAI/Claude API for intelligent features
 * Provides AI-powered insights, recommendations, and analysis
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getRecords, queryRecords, getRecord, updateRecord } from '../utils/firebaseDb.js';

// Initialize AI client (using OpenAI as example)
let aiClient = null;

try {
  // Dynamically import based on provider
  if (env.AI_PROVIDER === 'openai') {
    const { OpenAI } = await import('openai');
    aiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  } else if (env.AI_PROVIDER === 'anthropic') {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    aiClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
} catch (error) {
  logger.warn('AI client initialization failed:', error.message);
}

// ============================================================================
// ATTENDANCE ANALYSIS
// ============================================================================

export const analyzeAttendancePatterns = async (studentId, classId) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    // Get student attendance data
    const attendanceRecords = await queryRecords('attendance_records', (r) =>
      r.student_id === studentId && r.class_id === classId
    );

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return { success: false, error: 'No attendance data available' };
    }

    // Prepare data for AI analysis
    const attendanceData = attendanceRecords.map(r => ({
      date: r.date,
      status: r.status,
    }));

    const prompt = `Analyze the following student attendance data and provide insights:
    
Attendance Records: ${JSON.stringify(attendanceData)}

Please provide:
1. Attendance pattern analysis
2. Risk factors for poor attendance
3. Recommendations for improvement
4. Predicted future attendance trend

Format as JSON with keys: pattern, riskFactors, recommendations, prediction`;

    const response = await callAI(prompt);

    return {
      success: true,
      analysis: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error analyzing attendance patterns:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// GRADE ANALYSIS & FEEDBACK GENERATION
// ============================================================================

export const generateGradeFeedback = async (submissionId, marks, maxMarks, rubric) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    const percentage = (marks / maxMarks) * 100;

    const prompt = `Generate constructive feedback for a student submission:

Marks: ${marks}/${maxMarks} (${percentage.toFixed(1)}%)
Rubric: ${JSON.stringify(rubric)}

Please provide:
1. Strengths demonstrated
2. Areas for improvement
3. Specific actionable suggestions
4. Encouragement and motivation

Format as JSON with keys: strengths, improvements, suggestions, encouragement`;

    const response = await callAI(prompt);

    return {
      success: true,
      feedback: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error generating grade feedback:', error);
    return { success: false, error: error.message };
  }
};

export const identifyLearningGaps = async (studentId, classId) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    // Get student marks
    const marks = await queryRecords('marks', (m) =>
      m.student_id === studentId
    );

    if (!Array.isArray(marks) || marks.length === 0) {
      return { success: false, error: 'No marks data available' };
    }

    // Group by subject
    const subjectPerformance = {};
    marks.forEach(mark => {
      if (!subjectPerformance[mark.subject]) {
        subjectPerformance[mark.subject] = [];
      }
      subjectPerformance[mark.subject].push(Number(mark.score));
    });

    const prompt = `Analyze student performance and identify learning gaps:

Subject Performance: ${JSON.stringify(subjectPerformance)}

Please identify:
1. Subjects with lowest performance
2. Specific topics likely causing difficulties
3. Learning gaps and misconceptions
4. Recommended interventions
5. Personalized study strategies

Format as JSON with keys: weakSubjects, topics, gaps, interventions, strategies`;

    const response = await callAI(prompt);

    return {
      success: true,
      analysis: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error identifying learning gaps:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// PERFORMANCE PREDICTION
// ============================================================================

export const predictStudentPerformance = async (studentId, classId) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    // Get historical data
    const marks = await queryRecords('marks', (m) => m.student_id === studentId);
    const attendance = await queryRecords('attendance_records', (r) => r.student_id === studentId);
    const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);

    const prompt = `Predict student's future academic performance based on historical data:

Historical Marks: ${JSON.stringify(marks.slice(-10))}
Attendance Rate: ${((attendance.filter(a => a.status === 'present').length / attendance.length) * 100).toFixed(1)}%
Submission Rate: ${((submissions.filter(s => s.marks !== undefined).length / submissions.length) * 100).toFixed(1)}%

Please provide:
1. Performance trend (improving/declining/stable)
2. Predicted grade for next assessment
3. Confidence level (0-100%)
4. Risk factors
5. Recommendations to improve performance

Format as JSON with keys: trend, predictedGrade, confidence, riskFactors, recommendations`;

    const response = await callAI(prompt);

    return {
      success: true,
      prediction: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error predicting student performance:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// ASSIGNMENT RECOMMENDATIONS
// ============================================================================

export const recommendAssignmentDifficulty = async (classId, subject) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    // Get class performance data
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const studentIds = enrollments.map(e => e.student_id);

    const marks = await queryRecords('marks', (m) =>
      studentIds.includes(m.student_id) && m.subject === subject
    );

    const averageScore = marks.length > 0
      ? marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length
      : 0;

    const prompt = `Recommend assignment difficulty level for a class:

Subject: ${subject}
Class Average Score: ${averageScore.toFixed(1)}%
Number of Students: ${studentIds.length}

Please recommend:
1. Difficulty level (Easy/Medium/Hard)
2. Justification
3. Suggested topics
4. Estimated completion time
5. Learning objectives

Format as JSON with keys: difficulty, justification, topics, estimatedTime, objectives`;

    const response = await callAI(prompt);

    return {
      success: true,
      recommendation: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error recommending assignment difficulty:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// NOTIFICATION GENERATION
// ============================================================================

export const generateSmartNotification = async (type, data) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    const prompt = `Generate a personalized notification message:

Type: ${type}
Data: ${JSON.stringify(data)}

Please generate:
1. Engaging subject line
2. Personalized message body
3. Call-to-action
4. Optimal send time (if applicable)

Format as JSON with keys: subject, message, cta, sendTime`;

    const response = await callAI(prompt);

    return {
      success: true,
      notification: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error generating smart notification:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// REPORT GENERATION
// ============================================================================

export const generateAIInsights = async (classId, term) => {
  try {
    if (!aiClient) throw new Error('AI client not initialized');

    // Get class data
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const studentIds = enrollments.map(e => e.student_id);

    const marks = await queryRecords('marks', (m) =>
      studentIds.includes(m.student_id) && m.term === term
    );

    const attendance = await queryRecords('attendance_records', (r) =>
      studentIds.includes(r.student_id)
    );

    const prompt = `Generate comprehensive insights for a class performance report:

Class Size: ${studentIds.length}
Average Score: ${(marks.reduce((sum, m) => sum + Number(m.score), 0) / marks.length).toFixed(1)}%
Average Attendance: ${((attendance.filter(a => a.status === 'present').length / attendance.length) * 100).toFixed(1)}%
Term: ${term}

Please provide:
1. Overall class performance summary
2. Key achievements
3. Areas needing improvement
4. Top performers (anonymized)
5. At-risk students (anonymized)
6. Recommendations for teachers
7. Recommendations for parents

Format as JSON with keys: summary, achievements, improvements, topPerformers, atRisk, teacherRecs, parentRecs`;

    const response = await callAI(prompt);

    return {
      success: true,
      insights: parseAIResponse(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error generating AI insights:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Call AI API with caching
 */
async function callAI(prompt, cacheKey = null) {
  try {
    if (!aiClient) {
      throw new Error('AI client not initialized. Check AI_PROVIDER configuration.');
    }

    // Check cache first
    if (cacheKey) {
      const cached = await getRecord(`ai_cache/${cacheKey}`);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        logger.info('AI response from cache');
        return cached.result;
      }
    }

    let response;

    if (env.AI_PROVIDER === 'openai') {
      const completion = await aiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });
      response = completion.choices[0]?.message?.content;
      if (!response) throw new Error('No response from OpenAI');
    } else if (env.AI_PROVIDER === 'anthropic') {
      const message = await aiClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = message.content[0]?.text;
      if (!response) throw new Error('No response from Anthropic');
    } else {
      throw new Error(`Unknown AI provider: ${env.AI_PROVIDER}`);
    }

    // Cache the response
    if (cacheKey) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Cache for 24 hours

      await updateRecord(`ai_cache/${cacheKey}`, {
        result: response,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    }

    return response;
  } catch (error) {
    logger.error('Error calling AI API:', error);
    throw error;
  }
}

/**
 * Parse AI response to JSON
 */
function parseAIResponse(response) {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { raw: response };
  } catch (error) {
    logger.warn('Error parsing AI response:', error);
    return { raw: response };
  }
}

export default {
  analyzeAttendancePatterns,
  generateGradeFeedback,
  identifyLearningGaps,
  predictStudentPerformance,
  recommendAssignmentDifficulty,
  generateSmartNotification,
  generateAIInsights,
};
