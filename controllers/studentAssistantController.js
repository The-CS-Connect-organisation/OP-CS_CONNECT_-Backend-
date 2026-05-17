/**
 * Student Assistant Controller
 * AI-Powered Personal Study Assistant for students
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord, getStudentProfileByUserId } from '../utils/firebaseDb.js';
import { emitToUser } from '../utils/socket.js';
import { generateId } from '../utils/generateId.js';

// ============================================================================
// AI DOUBT RESOLUTION
// ============================================================================

export const resolveDoubt = asyncHandler(async (req, res) => {
  const { question, subject, context, imageUrl } = req.body;
  const studentId = req.user.id;
  
  if (!question && !imageUrl) {
    throw new ApiError(400, 'Either question text or image URL is required');
  }
  
  // Save doubt to history
  const doubtId = generateId();
  const doubtRecord = {
    id: doubtId,
    student_id: studentId,
    question,
    subject: subject || 'general',
    context: context || '',
    image_url: imageUrl || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`student_doubts/${doubtId}`, doubtRecord);
  
  // Generate AI response (simulated - would integrate with OpenAI/Claude API)
  const aiResponse = await generateAIResponse(question, subject, context);
  
  // Update doubt with response
  const updatedDoubt = {
    ...doubtRecord,
    response: aiResponse.response,
    explanation: aiResponse.explanation,
    related_topics: aiResponse.relatedTopics,
    confidence_score: aiResponse.confidenceScore,
    responded_at: new Date().toISOString(),
  };
  
  await updateRecord(`student_doubts/${doubtId}`, updatedDoubt);
  
  // Notify student via socket
  emitToUser(studentId, 'doubt:resolved', {
    doubtId,
    response: aiResponse.response,
    explanation: aiResponse.explanation,
  });
  
  res.json({
    success: true,
    doubt: {
      id: doubtId,
      question,
      response: aiResponse.response,
      explanation: aiResponse.explanation,
      relatedTopics: aiResponse.relatedTopics,
      confidenceScore: aiResponse.confidenceScore,
    }
  });
});

export const getDoubtHistory = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { subject, limit = 20, page = 1 } = req.query;
  
  let doubts = await queryRecords('student_doubts', (d) => d.student_id === studentId);
  
  if (subject && subject !== 'all') {
    doubts = doubts.filter(d => d.subject === subject);
  }
  
  // Sort by date descending
  doubts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const skip = (page - 1) * limit;
  const paginatedDoubts = doubts.slice(skip, skip + parseInt(limit));
  
  res.json({
    success: true,
    doubts: paginatedDoubts,
    total: doubts.length,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// ============================================================================
// STUDY PLAN GENERATOR
// ============================================================================

export const generateStudyPlan = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { days = 7, focusAreas = [], examDate } = req.body;
  
  // Get student's academic data
  const studentProfile = await getStudentProfileByUserId(studentId);
  if (!studentProfile) {
    throw new ApiError(404, 'Student profile not found');
  }
  
  // Get recent marks to identify weak areas
  const marks = await queryRecords('marks', (m) => m.student_id === studentId);
  const weakSubjects = identifyWeakSubjects(marks);
  
  // Get upcoming exams from timetable
  const upcomingExams = await getUpcomingExams(studentProfile.grade, studentProfile.section);
  
  // Generate personalized study plan
  const studyPlan = await createPersonalizedPlan({
    studentId,
    weakSubjects,
    focusAreas,
    upcomingExams,
    days: parseInt(days),
    examDate,
    learningStyle: studentProfile.learning_style || 'mixed',
  });
  
  // Save study plan
  const planId = generateId();
  const planRecord = {
    id: planId,
    student_id: studentId,
    plan: studyPlan,
    created_at: new Date().toISOString(),
    completed: false,
    progress: 0,
  };
  
  await updateRecord(`study_plans/${planId}`, planRecord);
  
  res.json({
    success: true,
    plan: {
      id: planId,
      ...studyPlan,
    }
  });
});

export const getStudyPlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  
  const plan = await getRecord(`study_plans/${planId}`);
  if (!plan) {
    throw new ApiError(404, 'Study plan not found');
  }
  
  if (plan.student_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this plan');
  }
  
  res.json({ success: true, plan });
});

export const updateStudyPlanProgress = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const { taskId, completed } = req.body;
  
  const plan = await getRecord(`study_plans/${planId}`);
  if (!plan) {
    throw new ApiError(404, 'Study plan not found');
  }
  
  // Update task completion
  const updatedTasks = plan.plan.tasks.map(task => {
    if (task.id === taskId) {
      return { ...task, completed, completed_at: completed ? new Date().toISOString() : null };
    }
    return task;
  });
  
  // Calculate progress
  const completedTasks = updatedTasks.filter(t => t.completed).length;
  const progress = (completedTasks / updatedTasks.length) * 100;
  
  await updateRecord(`study_plans/${planId}`, {
    plan: { ...plan.plan, tasks: updatedTasks },
    progress,
    completed: progress >= 100,
  });
  
// Award XP for completing tasks
   if (completed) {
     const profile = await getStudentProfileByUserId(plan.student_id);
     if (profile) {
       await updateRecord(`student_profiles/${profile.id}`, {
         xp: (profile.xp || 0) + 10,
       });
     }
  }
  
  res.json({ success: true, progress });
});

// ============================================================================
// FLASHCARD GENERATOR
// ============================================================================

export const generateFlashcards = asyncHandler(async (req, res) => {
  const { text, subject, topic } = req.body;
  const studentId = req.user.id;
  
  if (!text) {
    throw new ApiError(400, 'Text content is required');
  }
  
  // Generate flashcards from text (simulated AI)
  const flashcards = await createFlashcardsFromText(text, subject, topic);
  
  // Save flashcards
  const flashcardSetId = generateId();
  const flashcardSet = {
    id: flashcardSetId,
    student_id: studentId,
    subject,
    topic,
    cards: flashcards,
    created_at: new Date().toISOString(),
    last_reviewed: null,
    mastery_level: 0, // 0-100
  };
  
  await updateRecord(`flashcards/${flashcardSetId}`, flashcardSet);
  
  res.json({
    success: true,
    flashcardSet: {
      id: flashcardSetId,
      cards: flashcards,
      totalCards: flashcards.length,
    }
  });
});

export const getFlashcards = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { subject } = req.query;
  
  let flashcardSets = await queryRecords('flashcards', (f) => f.student_id === studentId);
  
  if (subject) {
    flashcardSets = flashcardSets.filter(f => f.subject === subject);
  }
  
  res.json({ success: true, flashcardSets });
});

export const reviewFlashcard = asyncHandler(async (req, res) => {
  const { setId, cardId, rating } = req.body; // rating: 1-5 (1=hard, 5=easy)
  const studentId = req.user.id;
  
  const flashcardSet = await getRecord(`flashcards/${setId}`);
  if (!flashcardSet) {
    throw new ApiError(404, 'Flashcard set not found');
  }
  
  // Update card's spaced repetition schedule
  const card = flashcardSet.cards.find(c => c.id === cardId);
  if (!card) {
    throw new ApiError(404, 'Card not found');
  }
  
  // Calculate next review date based on rating (Leitner system)
  const intervals = [1, 3, 7, 14, 30]; // days
  const currentInterval = card.next_review_days || 1;
  const intervalIndex = intervals.indexOf(currentInterval);
  
  let nextInterval;
  if (rating >= 4) {
    // Easy - move to next interval
    nextInterval = intervals[Math.min(intervalIndex + 1, intervals.length - 1)];
  } else if (rating <= 2) {
    // Hard - reset to first interval
    nextInterval = intervals[0];
  } else {
    // Medium - stay at current interval
    nextInterval = currentInterval;
  }
  
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
  
  card.last_reviewed = new Date().toISOString();
  card.next_review_days = nextInterval;
  card.next_review_date = nextReviewDate.toISOString();
  card.mastery = (card.mastery || 0) + rating;
  
  await updateRecord(`flashcards/${setId}`, flashcardSet);
  
  res.json({
    success: true,
    nextReviewDate: nextReviewDate.toISOString(),
    interval: nextInterval,
  });
});

// ============================================================================
// PRACTICE TEST GENERATOR
// ============================================================================

export const generatePracticeTest = asyncHandler(async (req, res) => {
  const { subject, topic, difficulty = 'medium', questionCount = 10, timeLimit } = req.body;
  const studentId = req.user.id;
  
  // Get student's weak areas in this subject
  const marks = await queryRecords('marks', (m) => m.student_id === studentId && m.subject === subject);
  const weakTopics = identifyWeakTopics(marks, topic);
  
  // Generate questions (simulated - would use question bank or AI generation)
  const questions = await generateQuestions({
    subject,
    topic,
    difficulty,
    count: parseInt(questionCount),
    weakTopics,
  });
  
  // Create test
  const testId = generateId();
  const test = {
    id: testId,
    student_id: studentId,
    subject,
    topic,
    difficulty,
    questions,
    timeLimit: timeLimit ? parseInt(timeLimit) : null, // minutes
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    created_at: new Date().toISOString(),
    started_at: null,
    submitted_at: null,
    score: null,
    answers: [],
  };
  
  await updateRecord(`practice_tests/${testId}`, test);
  
  res.json({
    success: true,
    test: {
      id: testId,
      subject,
      topic,
      difficulty,
      questionCount: questions.length,
      totalMarks: test.totalMarks,
      timeLimit,
    }
  });
});

export const submitPracticeTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const { answers } = req.body;
  
  const test = await getRecord(`practice_tests/${testId}`);
  if (!test) {
    throw new ApiError(404, 'Test not found');
  }
  
  // Calculate score
  let score = 0;
  const evaluatedAnswers = test.questions.map((question, index) => {
    const studentAnswer = answers[index];
    const isCorrect = studentAnswer === question.correctAnswer;
    if (isCorrect) {
      score += question.marks;
    }
    return {
      questionId: question.id,
      studentAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      marks: isCorrect ? question.marks : 0,
    };
  });
  
  const percentage = (score / test.totalMarks) * 100;
  
  // Update test with results
  await updateRecord(`practice_tests/${testId}`, {
    answers: evaluatedAnswers,
    score,
    percentage,
    submitted_at: new Date().toISOString(),
    grade: getGradeFromPercentage(percentage),
  });
  
  // Update student's weak topics based on performance
  await updateWeakTopics(studentId, test.subject, test.topic, percentage);
  
  res.json({
    success: true,
    results: {
      score,
      totalMarks: test.totalMarks,
      percentage,
      grade: getGradeFromPercentage(percentage),
      answers: evaluatedAnswers,
    }
  });
});

export const getPracticeTests = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { subject, status = 'all' } = req.query;
  
  let tests = await queryRecords('practice_tests', (t) => t.student_id === studentId);
  
  if (subject) {
    tests = tests.filter(t => t.subject === subject);
  }
  
  if (status === 'completed') {
    tests = tests.filter(t => t.submitted_at !== null);
  } else if (status === 'pending') {
    tests = tests.filter(t => t.submitted_at === null);
  }
  
  // Sort by date descending
  tests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json({ success: true, tests });
});

// ============================================================================
// STUDY ANALYTICS
// ============================================================================

export const getStudyAnalytics = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { period = 30 } = req.query; // days
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
  
  // Get study sessions
  const studySessions = await queryRecords('study_sessions', (s) => 
    s.student_id === studentId && new Date(s.date) >= cutoffDate
  );
  
  // Get practice tests
  const practiceTests = await queryRecords('practice_tests', (t) => 
    t.student_id === studentId && new Date(t.created_at) >= cutoffDate
  );
  
  // Get flashcard reviews
  const flashcardReviews = await queryRecords('flashcard_reviews', (f) => 
    f.student_id === studentId && new Date(f.reviewed_at) >= cutoffDate
  );
  
  // Calculate metrics
  const totalStudyHours = studySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
  const avgTestScore = practiceTests.filter(t => t.submitted_at).length > 0
    ? practiceTests.filter(t => t.submitted_at).reduce((sum, t) => sum + (t.percentage || 0), 0) / practiceTests.filter(t => t.submitted_at).length
    : 0;
  
  // Study streak
  const uniqueStudyDays = new Set(studySessions.map(s => s.date.split('T')[0]));
  const currentStreak = calculateStreak(uniqueStudyDays);
  
  res.json({
    success: true,
    analytics: {
      period: parseInt(period),
      studyTime: {
        totalHours: totalStudyHours.toFixed(1),
        dailyAverage: (totalStudyHours / period).toFixed(1),
        sessions: studySessions.length,
      },
      practiceTests: {
        taken: practiceTests.length,
        completed: practiceTests.filter(t => t.submitted_at).length,
        averageScore: avgTestScore.toFixed(1),
        bestScore: practiceTests.length > 0 ? Math.max(...practiceTests.map(t => t.percentage || 0)).toFixed(1) : 0,
      },
      flashcards: {
        reviewed: flashcardReviews.length,
        dailyAverage: (flashcardReviews.length / period).toFixed(0),
      },
      streak: {
        current: currentStreak,
        longest: calculateLongestStreak(uniqueStudyDays),
      },
      subjects: await getSubjectBreakdown(studentId, cutoffDate),
    }
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateAIResponse(question, subject, context) {
  // This would integrate with OpenAI/Claude API
  // For now, return a simulated response
  return {
    response: `Based on your question about "${question}", here's a detailed explanation...`,
    explanation: 'This concept is important because...',
    relatedTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
    confidenceScore: 0.85,
  };
}

function identifyWeakSubjects(marks) {
  const subjectScores = {};
  marks.forEach(mark => {
    if (!subjectScores[mark.subject]) {
      subjectScores[mark.subject] = { total: 0, count: 0 };
    }
    subjectScores[mark.subject].total += Number(mark.score);
    subjectScores[mark.subject].count += 1;
  });
  
  return Object.entries(subjectScores)
    .map(([subject, data]) => ({
      subject,
      average: data.total / data.count,
    }))
    .filter(s => s.average < 70)
    .sort((a, b) => a.average - b.average);
}

function identifyWeakTopics(marks, topic) {
  // Analyze marks to find weak topics within a subject
  const topicScores = {};
  marks.forEach(mark => {
    if (mark.topic) {
      if (!topicScores[mark.topic]) {
        topicScores[mark.topic] = { total: 0, count: 0 };
      }
      topicScores[mark.topic].total += Number(mark.score);
      topicScores[mark.topic].count += 1;
    }
  });
  
  return Object.entries(topicScores)
    .map(([topic, data]) => ({
      topic,
      average: data.total / data.count,
    }))
    .filter(s => s.average < 75)
    .sort((a, b) => a.average - b.average)
    .slice(0, 3);
}

async function getUpcomingExams(grade, section) {
  // Get exams from timetable
  const timetables = await getRecords('timetables');
  const relevantTimetable = timetables.find(t => t.class_id === `${grade}_${section}`);
  
  if (!relevantTimetable) return [];
  
  const entries = typeof relevantTimetable.entries === 'string' 
    ? JSON.parse(relevantTimetable.entries) 
    : relevantTimetable.entries;
  
  // Filter for exam entries
  return entries.filter(e => e.type === 'exam').slice(0, 5);
}

async function createPersonalizedPlan({ studentId, weakSubjects, focusAreas, upcomingExams, days, examDate, learningStyle }) {
  const tasks = [];
  const today = new Date();
  
  // Generate daily tasks
  for (let day = 0; day < days; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    
    // Morning session
    tasks.push({
      id: `task_${day}_1`,
      date: date.toISOString().split('T')[0],
      time: '09:00',
      title: `Review ${weakSubjects[0]?.subject || 'Mathematics'}`,
      description: 'Focus on weak areas identified from recent tests',
      duration: 60,
      type: 'study',
      subject: weakSubjects[0]?.subject || 'Mathematics',
      completed: false,
    });
    
    // Afternoon session
    tasks.push({
      id: `task_${day}_2`,
      date: date.toISOString().split('T')[0],
      time: '15:00',
      title: 'Practice Problems',
      description: 'Solve 10 practice problems',
      duration: 45,
      type: 'practice',
      subject: weakSubjects[1]?.subject || 'Science',
      completed: false,
    });
    
    // Evening session
    tasks.push({
      id: `task_${day}_3`,
      date: date.toISOString().split('T')[0],
      time: '19:00',
      title: 'Flashcard Review',
      description: 'Review spaced repetition flashcards',
      duration: 30,
      type: 'review',
      subject: 'Mixed',
      completed: false,
    });
  }
  
  return {
    startDate: today.toISOString().split('T')[0],
    endDate: new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalDays: days,
    tasks,
    focusAreas: weakSubjects.map(s => s.subject),
    learningStyle,
  };
}

async function createFlashcardsFromText(text, subject, topic) {
  // This would use AI to extract key concepts and generate Q&A pairs
  // For now, return simulated flashcards
  const cards = [];
  const sentences = text.split('.').filter(s => s.trim().length > 20);
  
  sentences.slice(0, 5).forEach((sentence, index) => {
    cards.push({
      id: `card_${index}`,
      front: `What is the key concept in: "${sentence.trim().slice(0, 50)}..."?`,
      back: sentence.trim(),
      tags: [subject, topic],
      difficulty: 'medium',
      next_review_days: 1,
      mastery: 0,
    });
  });
  
  return cards;
}

async function generateQuestions({ subject, topic, difficulty, count, weakTopics }) {
  // This would generate questions from a question bank or AI
  const questions = [];
  
  for (let i = 0; i < count; i++) {
    questions.push({
      id: `q_${i}`,
      type: 'multiple_choice',
      question: `Question ${i + 1} about ${topic} (${difficulty})`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'A',
      marks: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
      explanation: 'This is the correct answer because...',
      topic: weakTopics[i % weakTopics.length]?.topic || topic,
    });
  }
  
  return questions;
}

function getGradeFromPercentage(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

function calculateStreak(uniqueDays) {
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let currentDate = new Date();
  
  while (uniqueDays.has(currentDate.toISOString().split('T')[0])) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return streak;
}

function calculateLongestStreak(uniqueDays) {
  let longest = 0;
  let current = 0;
  let prevDate = null;
  
  const sortedDays = Array.from(uniqueDays).sort();
  
  for (const day of sortedDays) {
    if (!prevDate) {
      current = 1;
    } else {
      const daysDiff = (new Date(day) - new Date(prevDate)) / (1000 * 60 * 60 * 24);
      if (daysDiff === 1) {
        current++;
      } else {
        current = 1;
      }
    }
    longest = Math.max(longest, current);
    prevDate = day;
  }
  
  return longest;
}

async function updateWeakTopics(studentId, subject, topic, percentage) {
   // Update student's weak topics based on test performance
   const profile = await getStudentProfileByUserId(studentId);
  if (profile) {
    const weakTopics = profile.weak_topics || {};
    if (!weakTopics[subject]) {
      weakTopics[subject] = [];
    }
    
    if (percentage < 70) {
      if (!weakTopics[subject].includes(topic)) {
        weakTopics[subject].push(topic);
      }
    } else {
      weakTopics[subject] = weakTopics[subject].filter(t => t !== topic);
    }
    
    await updateRecord(`student_profiles/${studentId}`, { weak_topics: weakTopics });
  }
}

async function getSubjectBreakdown(studentId, cutoffDate) {
  const sessions = await queryRecords('study_sessions', (s) => 
    s.student_id === studentId && new Date(s.date) >= cutoffDate
  );
  
  const subjectTime = {};
  sessions.forEach(session => {
    const subject = session.subject || 'Other';
    if (!subjectTime[subject]) {
      subjectTime[subject] = 0;
    }
    subjectTime[subject] += session.duration_minutes || 0;
  });
  
  return Object.entries(subjectTime).map(([subject, minutes]) => ({
    subject,
    minutes,
    hours: (minutes / 60).toFixed(1),
    percentage: 0, // Will calculate after getting total
  }));
}

// ============================================================================
// AI ANSWER SCORER (English Writing Analysis)
// ============================================================================

export const scoreAnswer = asyncHandler(async (req, res) => {
  const { text, subject = 'english', questionPrompt, maxScore = 10, imageUrl } = req.body;
  const studentId = req.user.id;
  
  if (!text && !imageUrl) {
    throw new ApiError(400, 'Either text content or image URL is required');
  }
  
  // Extract text from image if provided (simulated - would use OCR API)
  const extractedText = imageUrl ? await extractTextFromImage(imageUrl) : text;
  
  // Analyze the answer
  const analysis = await analyzeWrittenAnswer(extractedText, subject, questionPrompt, maxScore);
  
  // Save analysis to history
  const analysisId = generateId();
  const analysisRecord = {
    id: analysisId,
    student_id: studentId,
    text: extractedText,
    subject,
    question_prompt: questionPrompt || '',
    analysis: analysis,
    created_at: new Date().toISOString(),
  };
  
  await updateRecord(`answer_analyses/${analysisId}`, analysisRecord);
  
  // Notify student via socket
  emitToUser(studentId, 'answer:scored', {
    analysisId,
    score: analysis.overallScore,
    grade: analysis.grade,
  });
  
  res.json({
    success: true,
    analysis: {
      id: analysisId,
      ...analysis,
    }
  });
});

export const getAnswerAnalysisHistory = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { subject, limit = 20, page = 1 } = req.query;
  
  let analyses = await queryRecords('answer_analyses', (a) => a.student_id === studentId);
  
  if (subject && subject !== 'all') {
    analyses = analyses.filter(a => a.subject === subject);
  }
  
  // Sort by date descending
  analyses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const skip = (page - 1) * limit;
  const paginatedAnalyses = analyses.slice(skip, skip + parseInt(limit));
  
  res.json({
    success: true,
    analyses: paginatedAnalyses,
    total: analyses.length,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// ============================================================================
// HELPER FUNCTIONS FOR ANSWER SCORING
// ============================================================================

async function extractTextFromImage(imageUrl) {
  // This would integrate with Google Vision API or AWS Textract
  // For now, return simulated text
  return "The quick brown fox jumps over the lazy dog. This is a sample answer that demonstrates various writing elements including proper grammar, vocabulary, and sentence structure.";
}

async function analyzeWrittenAnswer(text, subject, questionPrompt, maxScore) {
  // Comprehensive writing analysis
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // 1. Grammar Analysis (Enhanced)
  const grammarAnalysis = analyzeGrammarDetailed(text);
  
  // 2. Sentence Structure Analysis (Enhanced)
  const sentenceStructure = analyzeSentenceStructureDetailed(sentences);
  
  // 3. Vocabulary Analysis (Enhanced)
  const vocabularyAnalysis = analyzeVocabularyDetailed(words, text);
  
  // 4. Expression & Style Analysis (Enhanced)
  const expressionAnalysis = analyzeExpressionsDetailed(text);
  
  // 5. Coherence & Flow Analysis (Enhanced)
  const coherenceAnalysis = analyzeCoherenceDetailed(text, sentences, paragraphs);
  
  // 6. Content Relevance (if question prompt provided)
  const relevanceAnalysis = questionPrompt ? analyzeRelevanceDetailed(text, questionPrompt) : null;
  
  // 7. Writing Style Analysis
  const styleAnalysis = analyzeWritingStyle(text, sentences, paragraphs);
  
  // 8. Technical Writing Elements
  const technicalElements = analyzeTechnicalElements(text);
  
  // Calculate overall score with refined weights
  const scoringWeights = {
    grammar: 0.20,
    sentenceStructure: 0.15,
    vocabulary: 0.15,
    expression: 0.15,
    coherence: 0.15,
    style: 0.10,
    relevance: 0.10,
  };
  
  let overallScore = 0;
  overallScore += grammarAnalysis.score * scoringWeights.grammar;
  overallScore += sentenceStructure.score * scoringWeights.sentenceStructure;
  overallScore += vocabularyAnalysis.score * scoringWeights.vocabulary;
  overallScore += expressionAnalysis.score * scoringWeights.expression;
  overallScore += coherenceAnalysis.score * scoringWeights.coherence;
  overallScore += styleAnalysis.score * scoringWeights.style;
  if (relevanceAnalysis) {
    overallScore += relevanceAnalysis.score * scoringWeights.relevance;
  }
  
  // Normalize to max score
  const normalizedScore = (overallScore / 100) * maxScore;
  const grade = getGradeFromPercentage((normalizedScore / maxScore) * 100);
  
  // Generate detailed suggestions for improvement
  const suggestions = generateDetailedImprovementSuggestions({
    grammar: grammarAnalysis,
    sentenceStructure,
    vocabulary: vocabularyAnalysis,
    expression: expressionAnalysis,
    coherence: coherenceAnalysis,
    style: styleAnalysis,
    relevance: relevanceAnalysis,
    technicalElements,
  });
  
  // Identify detailed strengths
  const strengths = identifyDetailedStrengths({
    grammar: grammarAnalysis,
    sentenceStructure,
    vocabulary: vocabularyAnalysis,
    expression: expressionAnalysis,
    coherence: coherenceAnalysis,
    style: styleAnalysis,
  });
  
  // Generate improvement roadmap
  const improvementRoadmap = generateImprovementRoadmap({
    grammar: grammarAnalysis,
    vocabulary: vocabularyAnalysis,
    coherence: coherenceAnalysis,
    style: styleAnalysis,
  });
  
  return {
    // Overall metrics
    overallScore: Math.round(normalizedScore * 100) / 100,
    maxScore,
    grade,
    percentage: Math.round((normalizedScore / maxScore) * 100),
    
    // Basic counts
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgSentenceLength: (words.length / sentences.length).toFixed(1),
    avgParagraphLength: (sentences.length / Math.max(paragraphs.length, 1)).toFixed(1),
    
    // Detailed analysis breakdown
    grammar: grammarAnalysis,
    sentenceStructure,
    vocabulary: vocabularyAnalysis,
    expression: expressionAnalysis,
    coherence: coherenceAnalysis,
    style: styleAnalysis,
    relevance: relevanceAnalysis,
    technicalElements,
    
    // Suggestions and strengths
    suggestions,
    strengths,
    improvementRoadmap,
    
    // Detected elements
    detectedElements: {
      idioms: expressionAnalysis.idioms,
      proverbs: expressionAnalysis.proverbs,
      quotes: expressionAnalysis.quotes,
      advancedVocabulary: vocabularyAnalysis.advancedWords,
      transitionWords: coherenceAnalysis.transitionWords,
      rhetoricalDevices: expressionAnalysis.rhetoricalDevices,
      literaryDevices: expressionAnalysis.literaryDevices,
    },
    
    // Writing metrics
    writingMetrics: {
      readabilityScore: calculateReadabilityScore(text, sentences, words),
      formalityLevel: assessFormalityLevel(text, words),
      toneAnalysis: analyzeTone(text),
      voiceAnalysis: analyzeVoice(text),
    },
  };
}

// ============================================================================
// ENHANCED ANALYSIS FUNCTIONS
// ============================================================================

function analyzeGrammarDetailed(text) {
  const errors = [];
  const warnings = [];
  let score = 100;
  
  // Comprehensive grammar checks
  const grammarChecks = [
    // Capitalization errors
    { 
      pattern: /\bi\b(?!\')/, 
      error: 'Uncapitalized "I" pronoun', 
      severity: 'medium',
      category: 'capitalization',
      suggestion: 'Always capitalize the pronoun "I"'
    },
    { 
      pattern: /^\s*[a-z]/, 
      error: 'Sentence not starting with capital letter', 
      severity: 'medium',
      category: 'capitalization',
      suggestion: 'Begin sentences with capital letters'
    },
    { 
      pattern: /\s{2,}/, 
      error: 'Multiple consecutive spaces', 
      severity: 'low',
      category: 'formatting',
      suggestion: 'Use single spaces between words'
    },
    
    // Contraction errors
    { 
      pattern: /\b(dont|cant|wont|isnt|arent|hasnt|havent|didnt|doesnt)\b/i, 
      error: 'Missing apostrophe in contraction', 
      severity: 'medium',
      category: 'punctuation',
      suggestion: 'Add apostrophe: don\'t, can\'t, won\'t, isn\'t, aren\'t, hasn\'t, haven\'t, didn\'t, doesn\'t'
    },
    
    // Common homophone confusion
    { 
      pattern: /\b(your)\s+(welcome|right|correct|wrong|amazing|beautiful|the|a|an)\b/i, 
      match: 'you\'re', 
      error: 'Possible "your" vs "you\'re" confusion', 
      severity: 'high',
      category: 'homophones',
      suggestion: 'Use "you\'re" (you are) when describing a state or action'
    },
    { 
      pattern: /\b(their)\s+(is|are|was|were|many|some|few|a|an|the)\b/i, 
      match: 'there', 
      error: 'Possible "their" vs "there" confusion', 
      severity: 'high',
      category: 'homophones',
      suggestion: 'Use "there" for location or existence'
    },
    { 
      pattern: /\b(its)\s+(a|an|the|beautiful|nice|good|great|important|possible)\b/i, 
      match: 'it\'s', 
      error: 'Possible "its" vs "it\'s" confusion', 
      severity: 'high',
      category: 'homophones',
      suggestion: 'Use "it\'s" (it is) when describing a state'
    },
    { 
      pattern: /\b(too)\s+(much|many|little|few|good|bad|big|small)\b/i,
      error: 'Check if "too" (excessive) is correct vs "to"',
      severity: 'low',
      category: 'homophones',
      suggestion: 'Ensure "too" means "also" or "excessively"'
    },
    
    // Subject-verb agreement
    { 
      pattern: /\b(he|she|it)\s+(have|do|are|were)\b/i, 
      error: 'Possible subject-verb agreement error', 
      severity: 'high',
      category: 'agreement',
      suggestion: 'Third person singular: he/she/it has/does/is/was'
    },
    { 
      pattern: /\b(they|we|you|I)\s+(has|does|is|was)\b/i,
      error: 'Possible subject-verb agreement error',
      severity: 'high', 
      category: 'agreement',
      suggestion: 'Plural subjects: they/we/you/I have/do/are/were'
    },
    
    // Double negatives
    { 
      pattern: /\b(don't|do not|doesn't|does not)\s+(no|never|nothing|nobody|nowhere)\b/i,
      error: 'Double negative detected',
      severity: 'high',
      category: 'negation',
      suggestion: 'Use single negation for clarity'
    },
    
    // Passive voice indicators (warning, not error)
    { 
      pattern: /\b(was|were|is|are|been|being)\s+\w+ed\b/i,
      error: 'Passive voice detected',
      severity: 'info',
      category: 'voice',
      suggestion: 'Consider using active voice for stronger writing'
    },
  ];
  
  grammarChecks.forEach(({ pattern, error, severity, category, suggestion }) => {
    const matches = text.match(pattern);
    if (matches) {
      const item = { 
        error, 
        count: matches.length, 
        severity,
        category,
        suggestion,
        examples: matches.slice(0, 3) // Show first 3 examples
      };
      
      if (severity === 'info') {
        warnings.push(item);
      } else {
        errors.push(item);
        score -= severity === 'low' ? 2 : severity === 'medium' ? 5 : 10;
      }
    }
  });
  
  // Tense analysis
  const tenseAnalysis = analyzeTenseUsage(text);
  if (tenseAnalysis.consistency === 'mixed') {
    errors.push({
      error: 'Inconsistent tense usage',
      count: 1,
      severity: 'medium',
      category: 'tense',
      suggestion: `Primary tense appears to be ${tenseAnalysis.dominantTense}. Maintain consistency.`,
      details: tenseAnalysis
    });
    score -= 5;
  }
  
  return {
    score: Math.max(0, score),
    errors,
    warnings,
    totalErrors: errors.length,
    criticalErrors: errors.filter(e => e.severity === 'high').length,
    tenseAnalysis,
    punctuationScore: analyzePunctuationDetailed(text),
    categoryBreakdown: categorizeErrors(errors),
  };
}

function analyzeTenseUsage(text) {
  const pastTenseIndicators = [
    /\b\w+ed\b/g, // Regular past tense
    /\b(was|were|had|did)\b/gi,
    /\b(went|came|said|thought|knew|saw|found|made|took|gave)\b/gi
  ];
  
  const presentTenseIndicators = [
    /\b\w+s\b/g, // Third person singular
    /\b(am|is|are|has|have|do|does)\b/gi,
    /\b(go|come|say|think|know|see|find|make|take|give)\b/gi
  ];
  
  const futureTenseIndicators = [
    /\b(will|shall|going to)\b/gi
  ];
  
  let pastCount = 0;
  let presentCount = 0;
  let futureCount = 0;
  
  pastTenseIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) pastCount += matches.length;
  });
  
  presentTenseIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) presentCount += matches.length;
  });
  
  futureTenseIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) futureCount += matches.length;
  });
  
  const maxCount = Math.max(pastCount, presentCount, futureCount);
  let dominantTense = 'present';
  if (maxCount === pastCount) dominantTense = 'past';
  if (maxCount === futureCount) dominantTense = 'future';
  
  const consistency = (pastCount > 0 && presentCount > 0) || 
                      (pastCount > 0 && futureCount > 0) ||
                      (presentCount > 0 && futureCount > 0) ? 'mixed' : 'consistent';
  
  return {
    consistency,
    dominantTense,
    counts: { past: pastCount, present: presentCount, future: futureCount },
  };
}

function analyzePunctuationDetailed(text) {
  let score = 100;
  const issues = [];
  
  // Check sentence endings
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hasProperEndings = text.match(/[.!?]\s+[A-Z]/g);
  if (!hasProperEndings && sentences.length > 1) {
    issues.push('Missing proper sentence endings');
    score -= 10;
  }
  
  // Comma usage analysis
  const commaCount = (text.match(/,/g) || []).length;
  const expectedCommas = Math.floor(text.split(/\s+/).length / 15);
  if (commaCount < expectedCommas * 0.5) {
    issues.push('Insufficient comma usage - consider adding more pauses');
    score -= 5;
  }
  if (commaCount > expectedCommas * 2) {
    issues.push('Excessive comma usage - sentences may be too complex');
    score -= 5;
  }
  
  // Semicolon usage
  const semicolonCount = (text.match(/;/g) || []).length;
  
  // Colon usage
  const colonCount = (text.match(/:/g) || []).length;
  
  // Exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > sentences.length * 0.3) {
    issues.push('Too many exclamation marks - may appear unprofessional');
    score -= 5;
  }
  
  // Question marks
  const questionCount = (text.match(/\?/g) || []).length;
  
  return {
    score: Math.max(0, score),
    issues,
    counts: {
      commas: commaCount,
      semicolons: semicolonCount,
      colons: colonCount,
      exclamationMarks: exclamationCount,
      questionMarks: questionCount,
      sentences: sentences.length,
    },
  };
}

function categorizeErrors(errors) {
  const categories = {};
  errors.forEach(error => {
    if (!categories[error.category]) {
      categories[error.category] = { count: 0, severity: error.severity };
    }
    categories[error.category].count += error.count;
  });
  return categories;
}

function analyzeSentenceStructureDetailed(sentences) {
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  
  // Detailed sentence length analysis
  const veryShort = lengths.filter(l => l < 5).length;
  const shortSentences = lengths.filter(l => l >= 5 && l < 10).length;
  const mediumSentences = lengths.filter(l => l >= 10 && l <= 20).length;
  const longSentences = lengths.filter(l => l > 20 && l <= 30).length;
  const veryLong = lengths.filter(l => l > 30).length;
  
  // Sentence type analysis
  const declarative = sentences.filter(s => s.trim().match(/^[A-Z].*\.\s*$/)).length;
  const interrogative = sentences.filter(s => s.trim().match(/\?\s*$/)).length;
  const exclamatory = sentences.filter(s => s.trim().match(/!\s*$/)).length;
  const imperative = sentences.filter(s => s.trim().match(/^[A-Z]/) && !s.trim().match(/[.!?]\s*$/)).length;
  
  // Sentence complexity analysis
  const simpleCount = sentences.filter(s => {
    const clauses = s.split(/\b(who|which|that|whose|whom|where|when|while|because|although|if|unless)\b/i);
    return clauses.length <= 2;
  }).length;
  const complexCount = sentences.length - simpleCount;
  
  // Fragment detection
  const fragments = sentences.filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && 
           !trimmed.match(/^[A-Z]/) && 
           trimmed.split(/\s+/).length < 5 &&
           !trimmed.match(/[.!?]$/);
  });
  
  // Run-on sentence detection
  const runOnSentences = sentences.filter(s => {
    const wordCount = s.trim().split(/\s+/).length;
    const conjunctions = (s.match(/\b(and|but|or|nor|for|yet|so)\b/gi) || []).length;
    return wordCount > 35 && conjunctions > 2;
  });
  
  // Calculate variety score
  let varietyScore = 50;
  if (shortSentences > 0 && mediumSentences > 0) varietyScore += 15;
  if (longSentences > 0 && mediumSentences > 0) varietyScore += 10;
  if (interrogative > 0) varietyScore += 5;
  if (complexCount > 0 && simpleCount > 0) varietyScore += 10;
  
  let score = varietyScore - (fragments.length * 5) - (runOnSentences.length * 3);
  
  return {
    score: Math.max(0, Math.min(100, score)),
    avgLength: avgLength.toFixed(1),
    lengthDistribution: {
      veryShort,
      short: shortSentences,
      medium: mediumSentences,
      long: longSentences,
      veryLong,
    },
    sentenceTypes: {
      declarative,
      interrogative,
      exclamatory,
      imperative,
    },
    complexity: {
      simple: simpleCount,
      complex: complexCount,
      ratio: (complexCount / Math.max(simpleCount, 1)).toFixed(2),
    },
    fragments: fragments.length,
    runOnSentences: runOnSentences.length,
    totalSentences: sentences.length,
  };
}

function analyzeVocabularyDetailed(words, text) {
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/gi, '')));
  const advancedWords = [];
  const academicWords = [];
  const domainSpecificWords = [];
  
  // Extended advanced vocabulary list
  const advancedVocabList = [
    'analyze', 'comprehensive', 'significant', 'demonstrate', 'fundamental',
    'substantial', 'perspective', 'implication', 'methodology', 'phenomenon',
    'sophisticated', 'contemporary', 'implementation', 'infrastructure', 'paradigm',
    'exemplify', 'elucidate', 'corroborate', 'juxtapose', 'ubiquitous',
    'pragmatic', 'aesthetic', 'paradox', 'ephemeral', 'resilient',
    'articulate', 'coherent', 'cogent', 'lucid', 'erudite',
    'profound', 'insightful', 'nuanced', 'salient', 'pivotal',
    'mitigate', 'exacerbate', 'ameliorate', 'deteriorate', 'fluctuate',
    'ubiquitous', 'heterogeneous', 'homogeneous', 'synthesis', 'dichotomy',
  ];
  
  // Academic word list
  const academicWordList = [
    'analysis', 'approach', 'assessment', 'assumption', 'authority',
    'available', 'benefit', 'concept', 'consistent', 'constitute',
    'context', 'contract', 'create', 'data', 'definition',
    'derive', 'distribute', 'economic', 'environment', 'establish',
    'evidence', 'export', 'factor', 'final', 'formula',
    'function', 'identify', 'income', 'indicate', 'individual',
    'interpret', 'involve', 'issue', 'labour', 'legal',
    'major', 'occur', 'percent', 'period', 'policy',
    'principle', 'procedure', 'process', 'require', 'research',
    'respond', 'role', 'section', 'sector', 'significant',
    'similar', 'source', 'specific', 'structure', 'theory',
    'variable', 'welfare',
  ];
  
  uniqueWords.forEach(word => {
    if (advancedVocabList.includes(word.toLowerCase())) {
      advancedWords.push(word);
    }
    if (academicWordList.includes(word.toLowerCase())) {
      academicWords.push(word);
    }
  });
  
  // Lexical diversity (type-token ratio)
  const lexicalDiversity = uniqueWords.size / words.length;
  
  // Word frequency analysis
  const wordFrequency = {};
  words.forEach(word => {
    const lower = word.toLowerCase();
    wordFrequency[lower] = (wordFrequency[lower] || 0) + 1;
  });
  
  const repeatedWords = Object.entries(wordFrequency)
    .filter(([word, count]) => count > 3 && word.length > 3)
    .map(([word, count]) => ({ word, count }));
  
  // Calculate score
  let score = 50;
  score += Math.min(lexicalDiversity * 30, 25);
  score += Math.min(advancedWords.length * 3, 15);
  score += Math.min(academicWords.length * 2, 10);
  if (repeatedWords.length > 3) score -= 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    uniqueWords: uniqueWords.size,
    totalWords: words.length,
    lexicalDiversity: (lexicalDiversity * 100).toFixed(1) + '%',
    advancedWords,
    academicWords,
    wordComplexity: lexicalDiversity > 0.6 ? 'high' : lexicalDiversity > 0.4 ? 'medium' : 'basic',
    wordFrequency: Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count })),
    repeatedWords,
  };
}

function analyzeExpressionsDetailed(text) {
  const idioms = [];
  const proverbs = [];
  const quotes = [];
  const rhetoricalDevices = [];
  const literaryDevices = [];
  
  // Extended idiom patterns
  const idiomPatterns = [
    /break the ice/i, /piece of cake/i, /hit the nail on the head/i,
    /once in a blue moon/i, /cost an arm and a leg/i, /under the weather/i,
    /spill the beans/i, /beat around the bush/i, /the ball is in your court/i,
    /bite the bullet/i, /call it a day/i, /cut corners/i,
    /get out of hand/i, /hit the sack/i, /in the nick of time/i,
    /let the cat out of the bag/i, /miss the boat/i, /on the ball/i,
    /see eye to eye/i, /through thick and thin/i,
  ];
  
  // Extended proverb patterns
  const proverbPatterns = [
    /actions speak louder than words/i, /better late than never/i,
    /don't count your chickens/i, /every cloud has a silver lining/i,
    /practice makes perfect/i, /when in rome/i, /time is money/i,
    /the early bird catches the worm/i, /two wrongs don't make a right/i,
    /knowledge is power/i, /united we stand divided we fall/i,
    /where there's a will there's a way/i, /birds of a feather flock together/i,
  ];
  
  // Rhetorical devices
  const rhetoricalPatterns = [
    { pattern: /\b(\w+)\s+\1\b/i, device: 'Epizeuxis (repetition for emphasis)' },
    { pattern: /not only.*but also/i, device: 'Not only... but also (correlative conjunction)' },
    { pattern: /\w+,\s*\w+,\s*\w+/i, device: 'Tricolon (rule of three)' },
    { pattern: /\b(either|neither)\b.*\b(or|nor)\b/i, device: 'Either/Neither... or/nor (parallel structure)' },
    { pattern: /\b(whether)\b.*\b(or)\b/i, device: 'Whether... or (alternative structure)' },
  ];
  
  // Literary devices
  const literaryPatterns = [
    { pattern: /\blike\s+a\b/i, device: 'Simile' },
    { pattern: /\bas\s+(bright|dark|cold|hot|fast|slow|strong|weak|big|small)\s+as/i, device: 'Simile' },
    { pattern: /\b(\w+)\s+is\s+(\w+)\b/i, device: 'Metaphor (possible)' },
    { pattern: /\b(the)\s+(sun|moon|stars|wind|rain|time|death|love|life)\b/i, device: 'Personification (possible)' },
    { pattern: /\b(all|every|no|never|always|forever)\b/i, device: 'Hyperbole (possible)' },
  ];
  
  // Detect idioms
  idiomPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) idioms.push(match[0]);
    }
  });
  
  // Detect proverbs
  proverbPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) proverbs.push(match[0]);
    }
  });
  
  // Detect quotes
  const quotePattern = /["']([^"']+)["']/g;
  let quoteMatch;
  while ((quoteMatch = quotePattern.exec(text)) !== null) {
    quotes.push(quoteMatch[1]);
  }
  
  // Detect rhetorical devices
  rhetoricalPatterns.forEach(({ pattern, device }) => {
    if (pattern.test(text)) {
      rhetoricalDevices.push(device);
    }
  });
  
  // Detect literary devices
  literaryPatterns.forEach(({ pattern, device }) => {
    if (pattern.test(text)) {
      if (!literaryDevices.includes(device)) {
        literaryDevices.push(device);
      }
    }
  });
  
  let score = 50;
  score += Math.min(idioms.length * 8, 20);
  score += Math.min(proverbs.length * 8, 20);
  score += Math.min(quotes.length * 4, 10);
  score += Math.min(rhetoricalDevices.length * 5, 15);
  score += Math.min(literaryDevices.length * 3, 10);
  
  return {
    score: Math.max(0, Math.min(100, score)),
    idioms,
    proverbs,
    quotes,
    rhetoricalDevices,
    literaryDevices,
    figurativeLanguage: idioms.length + proverbs.length,
    totalDevices: rhetoricalDevices.length + literaryDevices.length,
  };
}

function analyzeCoherenceDetailed(text, sentences, paragraphs) {
  const transitionWords = [];
  const transitionCategories = {
    addition: [],
    contrast: [],
    cause: [],
    sequence: [],
    example: [],
    conclusion: [],
  };
  
  // Comprehensive transition word patterns by category
  const transitionPatterns = [
    // Addition
    { pattern: /\b(moreover|furthermore|additionally|also|besides|in addition|what's more)\b/i, category: 'addition' },
    // Contrast
    { pattern: /\b(however|nevertheless|nonetheless|on the other hand|in contrast|conversely|whereas|while|although|though)\b/i, category: 'contrast' },
    // Cause and Effect
    { pattern: /\b(therefore|consequently|thus|hence|accordingly|as a result|because|since|due to)\b/i, category: 'cause' },
    // Sequence
    { pattern: /\b(first|second|third|finally|next|then|meanwhile|subsequently|afterwards|previously)\b/i, category: 'sequence' },
    // Example
    { pattern: /\b(for example|for instance|specifically|in particular|namely|such as|including)\b/i, category: 'example' },
    // Conclusion
    { pattern: /\b(in conclusion|to summarize|in summary|overall|in brief|to conclude|all in all)\b/i, category: 'conclusion' },
  ];
  
  transitionPatterns.forEach(({ pattern, category }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const lower = match.toLowerCase();
        if (!transitionWords.includes(lower)) {
          transitionWords.push(lower);
        }
        if (!transitionCategories[category].includes(lower)) {
          transitionCategories[category].push(lower);
        }
      });
    }
  });
  
  // Paragraph structure analysis
  const hasIntro = paragraphs.length > 0 && 
    (paragraphs[0].toLowerCase().includes('introduction') ||
     paragraphs[0].toLowerCase().match(/^[a-z]*[Tt]he\s+/) ||
     paragraphs[0].toLowerCase().match(/^[a-z]*[Aa]n\s+/));
  
  const hasConclusion = paragraphs.length > 0 && 
    (paragraphs[paragraphs.length - 1].toLowerCase().includes('conclusion') ||
     paragraphs[paragraphs.length - 1].toLowerCase().includes('summary') ||
     transitionCategories.conclusion.length > 0);
  
  // Topic sentence detection
  const topicSentences = sentences.filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 10 && trimmed.length < 20 && trimmed.match(/^[A-Z]/);
  }).length;
  
  // Cohesion analysis - pronoun reference
  const pronouns = (text.match(/\b(he|she|it|they|we|you|this|that|these|those|his|her|their|our|your)\b/gi) || []).length;
  const pronounClarity = pronouns / sentences.length;
  
  // Calculate score
  let score = 40;
  score += Math.min(Object.keys(transitionCategories).filter(k => transitionCategories[k].length > 0).length * 8, 25);
  if (hasIntro) score += 10;
  if (hasConclusion) score += 10;
  if (paragraphs.length > 1) score += 5;
  if (topicSentences > 0) score += 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    transitionWords,
    transitionCount: transitionWords.length,
    transitionCategories,
    hasIntro,
    hasConclusion,
    paragraphCount: paragraphs.length,
    topicSentences,
    pronounClarity: pronounClarity.toFixed(2),
    structureScore: (hasIntro ? 50 : 0) + (hasConclusion ? 50 : 0),
  };
}

function analyzeWritingStyle(text, sentences, paragraphs) {
  // Formality analysis
  const contractions = (text.match(/\b(\w+)'\w+\b/g) || []).length;
  const formalWords = (text.match(/\b(moreover|furthermore|consequently|nevertheless|subsequently|accordingly)\b/gi) || []).length;
  const informalWords = (text.match(/\b(gonna|wanna|kinda|sorta|really|very|things|stuff)\b/gi) || []).length;
  
  const formalityScore = Math.min(100, 50 + (formalWords * 10) - (informalWords * 5) - (contractions * 3));
  
  // Passive vs Active voice
  const passiveIndicators = (text.match(/\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/gi) || []).length;
  const activeVoice = Math.max(0, sentences.length - passiveIndicators);
  const voiceRatio = (activeVoice / Math.max(sentences.length, 1)).toFixed(2);
  
  // Sentence length variation
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const variationScore = Math.min(100, (stdDev / avgLength) * 100);
  
  // Paragraph balance
  const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
  const avgParagraphLength = paragraphLengths.reduce((a, b) => a + b, 0) / Math.max(paragraphLengths.length, 1);
  const balanceScore = paragraphLengths.length > 1 
    ? 100 - (Math.max(...paragraphLengths) - Math.min(...paragraphLengths)) / avgParagraphLength * 20
    : 50;
  
  let score = 50;
  score += Math.min(formalityScore - 50, 15);
  score += Math.min(parseFloat(voiceRatio) > 0.7 ? 15 : parseFloat(voiceRatio) * 20, 15);
  score += Math.min(variationScore / 10, 10);
  score += Math.min(Math.max(0, balanceScore) / 10, 10);
  
  return {
    score: Math.max(0, Math.min(100, score)),
    formality: {
      score: formalityScore,
      level: formalityScore > 70 ? 'formal' : formalityScore > 40 ? 'semi-formal' : 'informal',
      contractions,
      formalWords,
      informalWords,
    },
    voice: {
      activeVoice: activeVoice,
      passiveVoice: passiveIndicators,
      ratio: voiceRatio,
    },
    variation: {
      avgSentenceLength: avgLength.toFixed(1),
      standardDeviation: stdDev.toFixed(1),
      variationScore: variationScore.toFixed(1),
    },
    paragraphBalance: {
      score: Math.max(0, balanceScore).toFixed(1),
      avgLength: avgParagraphLength.toFixed(0),
      count: paragraphs.length,
    },
  };
}

function analyzeTechnicalElements(text) {
  // Check for proper formatting
  const hasLineBreaks = text.includes('\n');
  const hasBulletPoints = text.match(/^[\s]*[-•*]\s+/m);
  const hasNumberedList = text.match(/^[\s]*\d+\.\s+/m);
  const hasBoldText = text.match(/\*\*(.+?)\*\*/g);
  const hasItalicText = text.match(/\*(.+?)\*/g);
  
  // Check for spelling patterns (simplified)
  const commonMisspellings = [
    { wrong: 'recieve', right: 'receive' },
    { wrong: 'occured', right: 'occurred' },
    { wrong: 'seperate', right: 'separate' },
    { wrong: 'definately', right: 'definitely' },
    { wrong: 'occassion', right: 'occasion' },
    { wrong: 'accomodate', right: 'accommodate' },
    { wrong: 'acheive', right: 'achieve' },
    { wrong: 'beleive', right: 'believe' },
    { wrong: 'untill', right: 'until' },
    { wrong: 'begining', right: 'beginning' },
  ];
  
  const spellingErrors = [];
  commonMisspellings.forEach(({ wrong, right }) => {
    if (new RegExp(`\\b${wrong}\\b`, 'i').test(text)) {
      spellingErrors.push({ wrong, right });
    }
  });
  
  return {
    formatting: {
      hasLineBreaks,
      hasBulletPoints: !!hasBulletPoints,
      hasNumberedList: !!hasNumberedList,
      hasBoldText: !!hasBoldText,
      hasItalicText: !!hasItalicText,
    },
    spellingErrors,
    wordCount: text.split(/\s+/).length,
  };
}

function analyzeRelevanceDetailed(text, questionPrompt) {
  const questionWords = questionPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const textLower = text.toLowerCase();
  
  const matchedKeywords = questionWords.filter(word => textLower.includes(word));
  const relevancePercentage = (matchedKeywords.length / Math.max(questionWords.length, 1)) * 100;
  
  // Check if answer addresses the question type
  const questionType = detectQuestionType(questionPrompt);
  const answerAddressesType = checkAnswerType(text, questionType);
  
  let score = relevancePercentage;
  if (answerAddressesType) score += 20;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    questionPrompt,
    questionType,
    matchedKeywords,
    missingKeywords: questionWords.filter(w => !matchedKeywords.includes(w)),
    totalKeywords: questionWords.length,
    relevancePercentage: relevancePercentage.toFixed(1) + '%',
    answerAddressesType,
  };
}

function detectQuestionType(question) {
  const lower = question.toLowerCase();
  if (lower.startsWith('what') || lower.startsWith('describe')) return 'descriptive';
  if (lower.startsWith('why') || lower.startsWith('explain')) return 'explanatory';
  if (lower.startsWith('how')) return 'procedural';
  if (lower.startsWith('compare') || lower.startsWith('contrast')) return 'comparative';
  if (lower.startsWith('discuss')) return 'discursive';
  if (lower.startsWith('evaluate') || lower.startsWith('assess')) return 'evaluative';
  if (lower.startsWith('analyze')) return 'analytical';
  return 'general';
}

function checkAnswerType(text, questionType) {
  const lower = text.toLowerCase();
  
  switch (questionType) {
    case 'descriptive':
      return lower.match(/\b(description|describe|characteristics|features|aspects)\b/i) !== null;
    case 'explanatory':
      return lower.match(/\b(because|therefore|thus|reason|cause|effect|explains)\b/i) !== null;
    case 'procedural':
      return lower.match(/\b(first|then|next|finally|step|process|method)\b/i) !== null;
    case 'comparative':
      return lower.match(/\b(similar|different|compare|contrast|whereas|however|both)\b/i) !== null;
    case 'evaluative':
      return lower.match(/\b(good|bad|effective|ineffective|strength|weakness|advantage|disadvantage)\b/i) !== null;
    case 'analytical':
      return lower.match(/\b(analysis|analyze|breakdown|examine|investigate)\b/i) !== null;
    default:
      return true;
  }
}

function calculateReadabilityScore(text, sentences, words) {
  // Flesch Reading Ease (simplified)
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
  const avgSyllablesPerWord = words.reduce((sum, w) => sum + countSyllables(w), 0) / Math.max(words.length, 1);
  
  const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  
  let level = 'college';
  if (fleschScore >= 90) level = 'very easy';
  else if (fleschScore >= 80) level = 'easy';
  else if (fleschScore >= 70) level = 'fairly easy';
  else if (fleschScore >= 60) level = 'standard';
  else if (fleschScore >= 50) level = 'fairly difficult';
  else if (fleschScore >= 30) level = 'difficult';
  
  return {
    fleschReadingEase: Math.max(0, Math.min(100, fleschScore)).toFixed(1),
    level,
    avgSentenceLength: avgSentenceLength.toFixed(1),
    avgWordLength: avgWordLength.toFixed(1),
    avgSyllablesPerWord: avgSyllablesPerWord.toFixed(1),
  };
}

function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  
  const vowels = 'aeiouy';
  let count = 0;
  let prevVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  
  if (word.endsWith('e')) count--;
  if (count === 0) count = 1;
  
  return count;
}

function assessFormalityLevel(text, words) {
  const contractions = (text.match(/\b(\w+)'\w+\b/g) || []).length;
  const firstPerson = (text.match(/\b(I|me|my|mine|we|us|our|ours)\b/gi) || []).length;
  const secondPerson = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  const slang = (text.match(/\b(gonna|wanna|kinda|sorta|cool|awesome|stuff|things)\b/gi) || []).length;
  
  const informalityScore = contractions * 2 + firstPerson * 3 + secondPerson * 2 + slang * 5;
  
  let level = 'formal';
  if (informalityScore > 20) level = 'informal';
  else if (informalityScore > 10) level = 'semi-formal';
  
  return {
    level,
    informalityScore,
    indicators: {
      contractions,
      firstPersonPronouns: firstPerson,
      secondPersonPronouns: secondPerson,
      slangTerms: slang,
    },
  };
}

function analyzeTone(text) {
  const positiveWords = (text.match(/\b(good|great|excellent|wonderful|amazing|fantastic|positive|beneficial|helpful|important|valuable|significant)\b/gi) || []).length;
  const negativeWords = (text.match(/\b(bad|terrible|awful|horrible|negative|harmful|useless|unimportant|insignificant|problem|issue|difficulty)\b/gi) || []).length;
  
  let tone = 'neutral';
  if (positiveWords > negativeWords * 2) tone = 'positive';
  else if (negativeWords > positiveWords * 2) tone = 'negative';
  else if (positiveWords > negativeWords) tone = 'mostly positive';
  else if (negativeWords > positiveWords) tone = 'mostly negative';
  
  return {
    tone,
    positiveWords,
    negativeWords,
    balance: positiveWords / Math.max(negativeWords, 1),
  };
}

function analyzeVoice(text) {
  const activeIndicators = (text.match(/\b(\w+)\s+(verb|action|do|make|create|build|write|speak|think|analyze|explain)\b/gi) || []).length;
  const passiveIndicators = (text.match(/\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/gi) || []).length;
  
  return {
    activeVoice: activeIndicators,
    passiveVoice: passiveIndicators,
    ratio: (activeIndicators / Math.max(passiveIndicators, 1)).toFixed(2),
  };
}

function generateDetailedImprovementSuggestions(analysis) {
  const suggestions = [];
  
  // Grammar suggestions
  if (analysis.grammar.errors.length > 0) {
    analysis.grammar.errors.forEach(error => {
      suggestions.push({
        category: 'grammar',
        priority: error.severity === 'high' ? 'high' : 'medium',
        issue: error.error,
        suggestion: error.suggestion,
        examples: error.examples,
        count: error.count,
      });
    });
  }
  
  // Warnings
  if (analysis.grammar.warnings.length > 0) {
    analysis.grammar.warnings.forEach(warning => {
      suggestions.push({
        category: 'grammar',
        priority: 'low',
        issue: warning.error,
        suggestion: warning.suggestion,
      });
    });
  }
  
  // Sentence structure suggestions
  if (analysis.sentenceStructure.avgLength > 25) {
    suggestions.push({
      category: 'sentence_structure',
      priority: 'medium',
      issue: 'Sentences are too long (avg: ' + analysis.sentenceStructure.avgLength + ' words)',
      suggestion: 'Break long sentences into shorter, clearer ones. Aim for 15-20 words per sentence.',
    });
  }
  
  if (analysis.sentenceStructure.fragments > 0) {
    suggestions.push({
      category: 'sentence_structure',
      priority: 'high',
      issue: `${analysis.sentenceStructure.fragments} sentence fragment(s) detected`,
      suggestion: 'Ensure all sentences have a subject and verb and express a complete thought.',
    });
  }
  
  if (analysis.sentenceStructure.runOnSentences > 0) {
    suggestions.push({
      category: 'sentence_structure',
      priority: 'medium',
      issue: `${analysis.sentenceStructure.runOnSentences} run-on sentence(s) detected`,
      suggestion: 'Break up long sentences with multiple conjunctions into separate sentences.',
    });
  }
  
  // Vocabulary suggestions
  if (analysis.vocabulary.repeatedWords.length > 3) {
    suggestions.push({
      category: 'vocabulary',
      priority: 'medium',
      issue: 'Frequent word repetition detected',
      suggestion: 'Use synonyms to avoid repeating the same words. Consider: ' + 
        analysis.vocabulary.repeatedWords.slice(0, 3).map(w => w.word).join(', '),
    });
  }
  
  if (analysis.vocabulary.advancedWords.length === 0) {
    suggestions.push({
      category: 'vocabulary',
      priority: 'low',
      issue: 'Limited advanced vocabulary',
      suggestion: 'Try incorporating more sophisticated words to enhance your writing.',
    });
  }
  
  // Expression suggestions
  if (analysis.expression.figurativeLanguage === 0 && analysis.expression.totalDevices === 0) {
    suggestions.push({
      category: 'expression',
      priority: 'low',
      issue: 'No figurative language or rhetorical devices detected',
      suggestion: 'Consider using idioms, proverbs, or rhetorical devices to make your writing more engaging.',
    });
  }
  
  // Coherence suggestions
  if (analysis.coherence.transitionCount < 3) {
    suggestions.push({
      category: 'coherence',
      priority: 'medium',
      issue: 'Limited use of transition words (' + analysis.coherence.transitionCount + ' found)',
      suggestion: 'Add transition words like "however", "therefore", "moreover", "for example" for better flow.',
    });
  }
  
  if (!analysis.coherence.hasConclusion && analysis.coherence.paragraphCount > 1) {
    suggestions.push({
      category: 'coherence',
      priority: 'medium',
      issue: 'No clear conclusion detected',
      suggestion: 'Add a concluding paragraph that summarizes your main points.',
    });
  }
  
  // Style suggestions
  if (analysis.style.formality.level === 'informal') {
    suggestions.push({
      category: 'style',
      priority: 'low',
      issue: 'Writing style is informal',
      suggestion: 'For academic writing, avoid contractions and slang. Use formal vocabulary.',
    });
  }
  
  if (parseFloat(analysis.style.voice.ratio) < 0.7) {
    suggestions.push({
      category: 'style',
      priority: 'low',
      issue: 'High use of passive voice',
      suggestion: 'Use active voice for clearer, more direct writing.',
    });
  }
  
  // Technical suggestions
  if (analysis.technicalElements.spellingErrors.length > 0) {
    analysis.technicalElements.spellingErrors.forEach(error => {
      suggestions.push({
        category: 'spelling',
        priority: 'high',
        issue: `Spelling error: "${error.wrong}"`,
        suggestion: `Use "${error.right}" instead.`,
      });
    });
  }
  
  return suggestions;
}

function identifyDetailedStrengths(analysis) {
  const strengths = [];
  
  if (analysis.grammar.score >= 90) {
    strengths.push({
      area: 'Grammar',
      description: 'Excellent grammar with minimal errors',
      score: analysis.grammar.score,
    });
  }
  
  if (analysis.grammar.tenseAnalysis.consistency === 'consistent') {
    strengths.push({
      area: 'Tense Consistency',
      description: `Consistent use of ${analysis.grammar.tenseAnalysis.dominantTense} tense`,
      score: 90,
    });
  }
  
  if (analysis.sentenceStructure.variety && 
      (analysis.sentenceStructure.variety.short > 0 && analysis.sentenceStructure.variety.medium > 0)) {
    strengths.push({
      area: 'Sentence Variety',
      description: 'Good mix of sentence lengths',
      score: 80,
    });
  }
  
  if (analysis.vocabulary.advancedWords.length >= 3) {
    strengths.push({
      area: 'Vocabulary',
      description: `Strong vocabulary with ${analysis.vocabulary.advancedWords.length} advanced words used`,
      score: 85,
    });
  }
  
  if (analysis.vocabulary.lexicalDiversity && parseFloat(analysis.vocabulary.lexicalDiversity) > 60) {
    strengths.push({
      area: 'Lexical Diversity',
      description: `High word variety (${analysis.vocabulary.lexicalDiversity})`,
      score: 85,
    });
  }
  
  if (analysis.expression.idioms.length > 0) {
    strengths.push({
      area: 'Idiomatic Expression',
      description: `Effective use of idioms: ${analysis.expression.idioms.join(', ')}`,
      score: 80,
    });
  }
  
  if (analysis.expression.proverbs.length > 0) {
    strengths.push({
      area: 'Proverbial Wisdom',
      description: `Incorporated proverbs: ${analysis.expression.proverbs.join(', ')}`,
      score: 80,
    });
  }
  
  if (analysis.expression.rhetoricalDevices.length > 0) {
    strengths.push({
      area: 'Rhetorical Devices',
      description: `Uses rhetorical devices: ${analysis.expression.rhetoricalDevices.join(', ')}`,
      score: 85,
    });
  }
  
  if (analysis.coherence.transitionCount >= 5) {
    strengths.push({
      area: 'Transitions',
      description: `Excellent use of transition words (${analysis.coherence.transitionCount} found)`,
      score: 90,
    });
  }
  
  if (analysis.coherence.hasIntro && analysis.coherence.hasConclusion) {
    strengths.push({
      area: 'Structure',
      description: 'Well-structured with clear introduction and conclusion',
      score: 90,
    });
  }
  
  if (analysis.style.formality.level === 'formal') {
    strengths.push({
      area: 'Formality',
      description: 'Appropriate formal writing style',
      score: 85,
    });
  }
  
  if (analysis.style.voice.ratio && parseFloat(analysis.style.voice.ratio) > 0.8) {
    strengths.push({
      area: 'Active Voice',
      description: 'Strong use of active voice for clear writing',
      score: 85,
    });
  }
  
  return strengths;
}

function generateImprovementRoadmap(analysis) {
  const roadmap = {
    immediate: [],
    shortTerm: [],
    longTerm: [],
  };
  
  // Immediate fixes (high priority)
  if (analysis.grammar.criticalErrors > 0) {
    roadmap.immediate.push('Fix critical grammar errors (subject-verb agreement, homophones)');
  }
  
  if (analysis.technicalElements.spellingErrors && analysis.technicalElements.spellingErrors.length > 0) {
    roadmap.immediate.push('Correct spelling errors');
  }
  
  // Short-term improvements (medium priority)
  if (analysis.coherence.transitionCount < 3) {
    roadmap.shortTerm.push('Add transition words to improve flow');
  }
  
  if (analysis.sentenceStructure.avgLength > 25) {
    roadmap.shortTerm.push('Break down long sentences');
  }
  
  if (analysis.style.formality.level === 'informal') {
    roadmap.shortTerm.push('Use more formal language');
  }
  
  // Long-term development (low priority but important)
  if (analysis.vocabulary.advancedWords.length < 3) {
    roadmap.longTerm.push('Expand vocabulary with advanced words');
  }
  
  if (analysis.expression.figurativeLanguage === 0) {
    roadmap.longTerm.push('Practice using idioms and rhetorical devices');
  }
  
  if (analysis.style.voice.ratio < 0.7) {
    roadmap.longTerm.push('Practice writing in active voice');
  }
  
  return roadmap;
}

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export default {
  resolveDoubt,
  getDoubtHistory,
  generateStudyPlan,
  getStudyPlan,
  updateStudyPlanProgress,
  generateFlashcards,
  getFlashcards,
  reviewFlashcard,
  generatePracticeTest,
  submitPracticeTest,
  getPracticeTests,
  getStudyAnalytics,
  scoreAnswer,
  getAnswerAnalysisHistory,
};
