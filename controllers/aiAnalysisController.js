import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import {
  analyzePerformance,
  analyzeTrends,
  generateRecommendations,
  generateWrittenAnalysis,
  calculateClassAverage,
  calculatePercentile
} from '../services/aiAnalysisService.js';

// ============================================================================
// TRIGGER AI ANALYSIS FOR A REPORT CARD
// ============================================================================
export const triggerAnalysis = asyncHandler(async (req, res) => {
  const { reportCardId } = req.body;

  if (!reportCardId) {
    throw new ApiError(400, 'reportCardId is required');
  }

  const reportCard = await getRecord(`report_cards/${reportCardId}`);

  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  // Check authorization
  if (req.user.role === 'student' && reportCard.student_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this report card');
  }

  // Get class average for comparison
  let classAverage = null;
  try {
    const classAvgData = await calculateClassAverage(reportCard.class_id, reportCard.term, reportCard.year);
    if (classAvgData) {
      classAverage = classAvgData.subjectAverages;
    }
  } catch (error) {
    console.warn('Failed to calculate class average:', error.message);
  }

  // Perform analysis
  const performance = analyzePerformance(reportCard, classAverage);
  const recommendations = generateRecommendations(performance);
  const writtenAnalysis = await generateWrittenAnalysis(reportCard, performance, recommendations);

  // Get trends if multiple report cards exist
  let trends = null;
  try {
    const allReportCards = await queryRecords('report_cards', (card) =>
      card.student_id === reportCard.student_id && card.status === 'Submitted'
    );
    if (allReportCards.length > 1) {
      trends = analyzeTrends(allReportCards);
    }
  } catch (error) {
    console.warn('Failed to analyze trends:', error.message);
  }

  // Create analysis record
  const analysisId = `analysis_${reportCardId}_${Date.now()}`;
  const analysis = {
    id: analysisId,
    report_card_id: reportCardId,
    student_id: reportCard.student_id,
    analysis_date: new Date().toISOString(),
    performance,
    recommendations,
    trends,
    written_analysis: writtenAnalysis,
    generated_by: 'AI_ENGINE',
    version: 1
  };

  await createRecord('ai_analysis', analysisId, analysis);

  // Update report card with analysis reference
  if (!reportCard.ai_analysis_ids) {
    reportCard.ai_analysis_ids = [];
  }
  reportCard.ai_analysis_ids.push(analysisId);
  await updateRecord('report_cards', reportCardId, reportCard);

  res.status(201).json({
    success: true,
    message: 'AI analysis generated successfully',
    data: analysis
  });
});

// ============================================================================
// GET STORED AI ANALYSIS
// ============================================================================
export const getAnalysis = asyncHandler(async (req, res) => {
  const { reportCardId } = req.params;

  if (!reportCardId) {
    throw new ApiError(400, 'reportCardId is required');
  }

  // Find analysis for this report card
  const analyses = await queryRecords('ai_analysis', (a) =>
    a.report_card_id === reportCardId
  );

  if (analyses.length === 0) {
    throw new ApiError(404, 'Analysis not found for this report card');
  }

  // Get the most recent analysis
  const analysis = analyses.sort((a, b) =>
    new Date(b.analysis_date) - new Date(a.analysis_date)
  )[0];

  // Check authorization
  const reportCard = await getRecord(`report_cards/${reportCardId}`);
  if (!reportCard) {
    throw new ApiError(404, 'Report card not found');
  }

  if (req.user.role === 'student' && reportCard.student_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this analysis');
  }

  if (req.user.role === 'teacher' && reportCard.teacher_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this analysis');
  }

  res.json({
    success: true,
    data: analysis
  });
});

// ============================================================================
// ANALYZE TRENDS ACROSS MULTIPLE TERMS
// ============================================================================
export const analyzeTrendAnalysis = asyncHandler(async (req, res) => {
  const { studentId, subjectId } = req.body;

  if (!studentId) {
    throw new ApiError(400, 'studentId is required');
  }

  // Check authorization
  if (req.user.role === 'student' && studentId !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this data');
  }

  // Get all report cards for the student
  const reportCards = await queryRecords('report_cards', (card) =>
    card.student_id === studentId && card.status === 'Submitted'
  );

  if (reportCards.length === 0) {
    throw new ApiError(404, 'No report cards found for this student');
  }

  // Analyze trends
  const trends = analyzeTrends(reportCards);

  // If specific subject requested, filter trends for that subject
  if (subjectId) {
    const subjectTrends = {};
    subjectTrends[subjectId] = trends.subjectTrends[subjectId];
    trends.subjectTrends = subjectTrends;
  }

  res.json({
    success: true,
    data: {
      studentId,
      trends,
      reportCardCount: reportCards.length,
      analysisDate: new Date().toISOString()
    }
  });
});

// ============================================================================
// GET CLASS AVERAGE
// ============================================================================
export const getClassAverage = asyncHandler(async (req, res) => {
  const { classId, term, year } = req.query;

  if (!classId || !term || !year) {
    throw new ApiError(400, 'classId, term, and year are required');
  }

  // Check authorization - only teachers and admins can access class averages
  if (req.user.role === 'student') {
    throw new ApiError(403, 'Students cannot access class averages');
  }

  const classAverage = await calculateClassAverage(classId, term, parseInt(year));

  if (!classAverage) {
    return res.json({
      success: true,
      message: 'No report cards found for this class',
      data: null
    });
  }

  res.json({
    success: true,
    data: classAverage
  });
});

// ============================================================================
// COMPARE STUDENT WITH CLASS AVERAGE
// ============================================================================
export const compareStudentWithClass = asyncHandler(async (req, res) => {
  const { studentId, term, year } = req.query;

  if (!studentId || !term || !year) {
    throw new ApiError(400, 'studentId, term, and year are required');
  }

  // Check authorization
  if (req.user.role === 'student' && studentId !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this data');
  }

  // Get student's report card
  const studentReportCards = await queryRecords('report_cards', (card) =>
    card.student_id === studentId && card.term === term && card.year === parseInt(year) && card.status === 'Submitted'
  );

  if (studentReportCards.length === 0) {
    throw new ApiError(404, 'Report card not found for this student');
  }

  const studentCard = studentReportCards[0];

  // Get class average
  const classAverage = await calculateClassAverage(studentCard.class_id, term, parseInt(year));

  if (!classAverage) {
    throw new ApiError(404, 'No class average data available');
  }

  // Calculate gaps and percentiles
  const comparison = {
    studentPerformance: {},
    classAverage: classAverage.subjectAverages,
    gaps: {},
    percentiles: {}
  };

  // Get all student percentages for percentile calculation
  const allReportCards = await queryRecords('report_cards', (card) =>
    card.class_id === studentCard.class_id && card.term === term && card.year === parseInt(year) && card.status === 'Submitted'
  );

  const allPercentages = allReportCards.map(card => card.overall_percentage);

  studentCard.subjects?.forEach((subject) => {
    comparison.studentPerformance[subject.name] = subject.percentage;
    const classAvg = classAverage.subjectAverages[subject.name] || 0;
    comparison.gaps[subject.name] = Math.round((subject.percentage - classAvg) * 100) / 100;
  });

  // Calculate overall percentile
  comparison.percentiles.overall = calculatePercentile(studentCard.overall_percentage, allPercentages);

  // Calculate subject-wise percentiles
  studentCard.subjects?.forEach((subject) => {
    const subjectPercentages = allReportCards
      .flatMap(card => card.subjects || [])
      .filter(s => s.name === subject.name)
      .map(s => s.percentage);

    comparison.percentiles[subject.name] = calculatePercentile(subject.percentage, subjectPercentages);
  });

  res.json({
    success: true,
    data: {
      studentId,
      term,
      year,
      comparison,
      classSize: classAverage.studentCount
    }
  });
});

// ============================================================================
// GET PERCENTILE RANK
// ============================================================================
export const getPercentileRank = asyncHandler(async (req, res) => {
  const { studentId, term, year, subject } = req.query;

  if (!studentId || !term || !year) {
    throw new ApiError(400, 'studentId, term, and year are required');
  }

  // Check authorization
  if (req.user.role === 'student' && studentId !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to access this data');
  }

  // Get student's report card
  const studentReportCards = await queryRecords('report_cards', (card) =>
    card.student_id === studentId && card.term === term && card.year === parseInt(year) && card.status === 'Submitted'
  );

  if (studentReportCards.length === 0) {
    throw new ApiError(404, 'Report card not found for this student');
  }

  const studentCard = studentReportCards[0];

  // Get all report cards for the class
  const allReportCards = await queryRecords('report_cards', (card) =>
    card.class_id === studentCard.class_id && card.term === term && card.year === parseInt(year) && card.status === 'Submitted'
  );

  let percentile = 0;
  let rank = 0;

  if (subject) {
    // Subject-specific percentile
    const studentSubject = studentCard.subjects?.find(s => s.name === subject);
    if (!studentSubject) {
      throw new ApiError(404, `Subject ${subject} not found in report card`);
    }

    const subjectPercentages = allReportCards
      .flatMap(card => card.subjects || [])
      .filter(s => s.name === subject)
      .map(s => s.percentage);

    percentile = calculatePercentile(studentSubject.percentage, subjectPercentages);
    rank = subjectPercentages.filter(p => p > studentSubject.percentage).length + 1;
  } else {
    // Overall percentile
    const allPercentages = allReportCards.map(card => card.overall_percentage);
    percentile = calculatePercentile(studentCard.overall_percentage, allPercentages);
    rank = allPercentages.filter(p => p > studentCard.overall_percentage).length + 1;
  }

  res.json({
    success: true,
    data: {
      studentId,
      term,
      year,
      subject: subject || 'overall',
      percentile,
      rank,
      totalStudents: allReportCards.length
    }
  });
});
