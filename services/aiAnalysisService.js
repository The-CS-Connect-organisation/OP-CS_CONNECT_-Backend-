import { getRecord, getRecords, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import { env } from '../config/env.js';

// Initialize Cerebras AI client
let cerebras = null;
try {
  if (env.CEREBRAS_API_KEY) {
    const axios = await import('axios');
    cerebras = {
      apiKey: env.CEREBRAS_API_KEY,
      baseURL: 'https://api.cerebras.ai/v1',
      client: axios.default
    };
  }
} catch (error) {
  console.warn('Cerebras AI not available, using template-based analysis');
}

// ============================================================================
// PERFORMANCE ANALYSIS ENGINE
// ============================================================================
export const analyzePerformance = (reportCard, classAverage = null) => {
  const subjects = reportCard.subjects || [];

  // Sort subjects by percentage
  const sortedByPercentage = [...subjects].sort((a, b) => b.percentage - a.percentage);

  // Identify strengths (top 3 subjects)
  const strengths = sortedByPercentage.slice(0, 3).map((subject) => ({
    subject: subject.name,
    percentage: subject.percentage,
    grade: subject.grade,
    feedback: generateStrengthFeedback(subject)
  }));

  // Identify weaknesses (bottom 3 subjects)
  const weaknesses = sortedByPercentage.slice(-3).reverse().map((subject) => ({
    subject: subject.name,
    percentage: subject.percentage,
    grade: subject.grade,
    feedback: generateWeaknessFeedback(subject)
  }));

  // Generate performance summary
  const summary = generatePerformanceSummary(strengths, weaknesses, reportCard.overall_percentage);

  // Class comparison
  let classComparison = null;
  if (classAverage) {
    classComparison = {
      aboveAverage: subjects
        .filter(s => s.percentage > (classAverage[s.name] || 0))
        .map(s => s.name),
      belowAverage: subjects
        .filter(s => s.percentage < (classAverage[s.name] || 0))
        .map(s => s.name),
      gaps: {}
    };

    subjects.forEach(subject => {
      const classAvg = classAverage[subject.name] || 0;
      classComparison.gaps[subject.name] = Math.round((subject.percentage - classAvg) * 100) / 100;
    });
  }

  return {
    strengths,
    weaknesses,
    summary,
    classComparison,
    overallPercentage: reportCard.overall_percentage,
    overallGrade: reportCard.overall_grade
  };
};

// ============================================================================
// TREND ANALYSIS ENGINE
// ============================================================================
export const analyzeTrends = (reportCards) => {
  if (!reportCards || reportCards.length === 0) {
    return null;
  }

  // Sort by term/year
  const sortedCards = [...reportCards].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.term.localeCompare(b.term);
  });

  // Calculate average per subject per term
  const subjectTrends = {};
  const subjectAverages = {};

  sortedCards.forEach((card) => {
    card.subjects?.forEach((subject) => {
      if (!subjectTrends[subject.name]) {
        subjectTrends[subject.name] = [];
        subjectAverages[subject.name] = [];
      }
      subjectTrends[subject.name].push({
        term: card.term,
        year: card.year,
        percentage: subject.percentage
      });
      subjectAverages[subject.name].push(subject.percentage);
    });
  });

  // Identify trend direction
  const trendDirections = {};
  const improvingSubjects = [];
  const decliningSubjects = [];
  const stableSubjects = [];

  Object.entries(subjectTrends).forEach(([subject, trends]) => {
    if (trends.length < 2) {
      trendDirections[subject] = 'stable';
      stableSubjects.push(subject);
      return;
    }

    const firstPercentage = trends[0].percentage;
    const lastPercentage = trends[trends.length - 1].percentage;
    const difference = lastPercentage - firstPercentage;

    if (difference > 5) {
      trendDirections[subject] = 'improving';
      improvingSubjects.push(subject);
    } else if (difference < -5) {
      trendDirections[subject] = 'declining';
      decliningSubjects.push(subject);
    } else {
      trendDirections[subject] = 'stable';
      stableSubjects.push(subject);
    }
  });

  // Identify consistent strengths and weaknesses
  const consistentStrengths = Object.entries(subjectAverages)
    .filter(([_, percentages]) => {
      const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      return avg >= 80;
    })
    .map(([subject]) => subject);

  const consistentWeaknesses = Object.entries(subjectAverages)
    .filter(([_, percentages]) => {
      const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      return avg < 60;
    })
    .map(([subject]) => subject);

  // Overall trend
  const overallPercentages = sortedCards.map(card => card.overall_percentage);
  let overallTrend = 'stable';
  if (overallPercentages.length >= 2) {
    const firstOverall = overallPercentages[0];
    const lastOverall = overallPercentages[overallPercentages.length - 1];
    const overallDifference = lastOverall - firstOverall;

    if (overallDifference > 5) {
      overallTrend = 'improving';
    } else if (overallDifference < -5) {
      overallTrend = 'declining';
    }
  }

  return {
    overallTrend,
    subjectTrends: trendDirections,
    consistentStrengths,
    consistentWeaknesses,
    improvingSubjects,
    decliningSubjects,
    stableSubjects,
    subjectAverages: Object.entries(subjectAverages).reduce((acc, [subject, percentages]) => {
      acc[subject] = Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100;
      return acc;
    }, {})
  };
};

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================
export const generateRecommendations = (performance, trends = null) => {
  const recommendations = [];

  // Generate recommendations for each weakness
  performance.weaknesses?.forEach((weakness, index) => {
    const priority = index + 1;
    const recommendation = {
      priority,
      subject: weakness.subject,
      weakness: weakness.feedback,
      recommendation: generateRecommendationText(weakness.subject, weakness.percentage),
      resources: generateResources(weakness.subject),
      studyStrategy: generateStudyStrategy(weakness.subject),
      timeAllocation: generateTimeAllocation(weakness.percentage),
      shortTermGoal: generateShortTermGoal(weakness.subject, weakness.percentage),
      longTermGoal: generateLongTermGoal(weakness.subject)
    };
    recommendations.push(recommendation);
  });

  // Add trend-based recommendations
  if (trends?.decliningSubjects?.length > 0) {
    trends.decliningSubjects.forEach((subject) => {
      const existingRec = recommendations.find(r => r.subject === subject);
      if (!existingRec) {
        recommendations.push({
          priority: recommendations.length + 1,
          subject,
          weakness: `Performance declining in ${subject}`,
          recommendation: `Focus on reversing the declining trend in ${subject}. Review previous concepts and practice regularly.`,
          resources: generateResources(subject),
          studyStrategy: 'Review and reinforce fundamentals',
          timeAllocation: '45 minutes daily',
          shortTermGoal: `Stabilize ${subject} performance`,
          longTermGoal: `Improve ${subject} to 75%+`
        });
      }
    });
  }

  return recommendations;
};

// ============================================================================
// WRITTEN ANALYSIS GENERATOR
// ============================================================================
export const generateWrittenAnalysis = async (reportCard, performance, recommendations) => {
  // Try to use Cerebras AI Qwen if available
  if (cerebras) {
    try {
      const prompt = buildAnalysisPrompt(reportCard, performance, recommendations);
      const response = await cerebras.client.post(
        `${cerebras.baseURL}/chat/completions`,
        {
          model: 'qwen-7b',
          messages: [
            {
              role: 'system',
              content: 'You are an educational analyst providing constructive feedback on student performance. Write in a professional, encouraging tone suitable for students and parents.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${cerebras.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.warn('Cerebras AI analysis failed, using template-based analysis:', error.message);
    }
  }

  // Fallback to template-based analysis
  return generateTemplateAnalysis(reportCard, performance, recommendations);
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateStrengthFeedback = (subject) => {
  const percentage = subject.percentage;
  if (percentage >= 90) return 'Excellent grasp of concepts';
  if (percentage >= 80) return 'Strong understanding and performance';
  return 'Good performance in this subject';
};

const generateWeaknessFeedback = (subject) => {
  const percentage = subject.percentage;
  if (percentage < 40) return 'Requires immediate attention and focused practice';
  if (percentage < 60) return 'Needs significant improvement and additional support';
  return 'Needs practice and reinforcement';
};

const generatePerformanceSummary = (strengths, weaknesses, overallPercentage) => {
  const strengthSubjects = strengths.map(s => s.subject).join(', ');
  const weaknessSubjects = weaknesses.map(w => w.subject).join(', ');

  let summary = `Overall performance: ${overallPercentage}%. `;
  if (strengths.length > 0) {
    summary += `Strong in ${strengthSubjects}. `;
  }
  if (weaknesses.length > 0) {
    summary += `Needs improvement in ${weaknessSubjects}.`;
  }

  return summary;
};

const generateRecommendationText = (subject, percentage) => {
  if (percentage < 40) {
    return `Focus on mastering fundamental concepts in ${subject}. Start with basic topics and gradually progress to advanced concepts.`;
  }
  if (percentage < 60) {
    return `Practice problem-solving in ${subject}. Work through textbook exercises and previous exam papers.`;
  }
  return `Continue practicing and refining skills in ${subject}. Focus on challenging topics.`;
};

const generateResources = (subject) => {
  const resourceMap = {
    'Mathematics': ['NCERT textbook exercises', 'Khan Academy videos', 'Practice problem sets'],
    'English': ['Reading comprehension exercises', 'Grammar practice', 'Essay writing guides'],
    'Science': ['NCERT science textbook', 'Experiment videos', 'Concept explanation videos'],
    'History': ['Timeline study guides', 'Historical documents', 'Documentary videos'],
    'Geography': ['Map study materials', 'Geography atlases', 'Documentary videos'],
    'Social Studies': ['Textbook chapters', 'Case study materials', 'Documentary videos']
  };

  return resourceMap[subject] || ['Textbook chapters', 'Online tutorials', 'Practice problems'];
};

const generateStudyStrategy = (subject) => {
  const strategies = {
    'Mathematics': 'Practice daily problem-solving. Start with easier problems and gradually increase difficulty.',
    'English': 'Read regularly and practice writing. Focus on grammar and vocabulary building.',
    'Science': 'Understand concepts through experiments and visualizations. Practice numerical problems.',
    'History': 'Create timelines and mind maps. Connect events to understand historical context.',
    'Geography': 'Use maps and visual aids. Practice map reading and location identification.',
    'Social Studies': 'Read case studies and analyze real-world examples. Participate in discussions.'
  };

  return strategies[subject] || 'Regular practice and consistent study. Review concepts regularly.';
};

const generateTimeAllocation = (percentage) => {
  if (percentage < 40) return '60 minutes daily';
  if (percentage < 60) return '45 minutes daily';
  return '30 minutes daily';
};

const generateShortTermGoal = (subject, percentage) => {
  const targetPercentage = Math.min(percentage + 10, 100);
  return `Improve ${subject} to ${targetPercentage}% in the next month`;
};

const generateLongTermGoal = (subject) => {
  return `Achieve 80%+ in ${subject} by end of term`;
};

const buildAnalysisPrompt = (reportCard, performance, recommendations) => {
  const strengthsList = performance.strengths.map(s => `${s.subject} (${s.percentage}%)`).join(', ');
  const weaknessList = performance.weaknesses.map(w => `${w.subject} (${w.percentage}%)`).join(', ');
  const recommendationsList = recommendations.slice(0, 3).map(r => `- ${r.recommendation}`).join('\n');

  return `
Analyze the following student performance report and provide constructive feedback:

Overall Performance: ${reportCard.overall_percentage}% (Grade: ${reportCard.overall_grade})
Strengths: ${strengthsList}
Weaknesses: ${weaknessList}

Key Recommendations:
${recommendationsList}

Please write a 200-300 word analysis that:
1. Summarizes overall performance
2. Discusses strengths and areas for improvement
3. Provides encouragement and constructive feedback
4. Emphasizes actionable next steps

Write in a professional, encouraging tone suitable for students and parents.
  `;
};

const generateTemplateAnalysis = (reportCard, performance, recommendations) => {
  const strengthsList = performance.strengths.map(s => s.subject).join(', ');
  const weaknessList = performance.weaknesses.map(w => w.subject).join(', ');

  let analysis = `
Performance Analysis Report

Overall Performance: ${reportCard.overall_percentage}% (Grade: ${reportCard.overall_grade})

Summary:
The student has demonstrated an overall performance of ${reportCard.overall_percentage}%, which reflects ${reportCard.overall_grade} grade performance. This analysis provides insights into strengths, areas for improvement, and personalized recommendations.

Strengths:
The student shows strong performance in ${strengthsList}. These subjects demonstrate solid understanding of concepts and consistent application of knowledge. This is commendable and should be built upon.

Areas for Improvement:
The student needs to focus on improving performance in ${weaknessList}. These subjects require additional practice, concept reinforcement, and targeted study strategies.

Recommendations:
${recommendations.slice(0, 3).map(r => `- ${r.recommendation}`).join('\n')}

Conclusion:
With consistent effort, focused practice, and implementation of the recommended strategies, the student can significantly improve performance. Regular review of concepts, active participation in class, and seeking help when needed will contribute to academic success.
  `;

  return analysis.trim();
};

// ============================================================================
// CLASS AVERAGE CALCULATION
// ============================================================================
export const calculateClassAverage = async (classId, term, year) => {
  const reportCards = await queryRecords('report_cards', (card) =>
    card.class_id === classId && card.term === term && card.year === year && card.status === 'Submitted'
  );

  if (reportCards.length === 0) {
    return null;
  }

  const subjectAverages = {};
  let totalPercentage = 0;

  reportCards.forEach((card) => {
    card.subjects?.forEach((subject) => {
      if (!subjectAverages[subject.name]) {
        subjectAverages[subject.name] = [];
      }
      subjectAverages[subject.name].push(subject.percentage);
    });
    totalPercentage += card.overall_percentage;
  });

  // Calculate averages
  const averages = {};
  Object.entries(subjectAverages).forEach(([subject, percentages]) => {
    averages[subject] = Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100;
  });

  const overallAverage = Math.round((totalPercentage / reportCards.length) * 100) / 100;

  return {
    subjectAverages: averages,
    overallAverage,
    studentCount: reportCards.length
  };
};

// ============================================================================
// PERCENTILE CALCULATION
// ============================================================================
export const calculatePercentile = (studentPercentage, allPercentages) => {
  if (!allPercentages || allPercentages.length === 0) {
    return 0;
  }

  const sortedPercentages = [...allPercentages].sort((a, b) => a - b);
  const count = sortedPercentages.filter(p => p <= studentPercentage).length;
  const percentile = Math.round((count / sortedPercentages.length) * 100);

  return percentile;
};
