import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord, batchWrite } from '../utils/firebaseDb.js';

export const createPortfolio = asyncHandler(async (req, res) => {
  const { studentId, academicYear, grade, section } = req.body;

  // Check if portfolio already exists
  const existing = await queryRecords('portfolios', (p) => p.studentId === studentId && p.academicYear === academicYear);
  if (existing.length > 0) {
    throw new ApiError(409, 'Portfolio already exists for this student and academic year');
  }

  const portfolioId = Date.now().toString();
  const portfolio = {
    id: portfolioId,
    studentId,
    academicYear: academicYear || new Date().getFullYear().toString(),
    grade: grade || null,
    section: section || null,
    createdBy: req.user.id,
    items: [],
    totalAchievements: 0,
    skills: [],
    objectives: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createRecord(`portfolios/${portfolioId}`, portfolio);
  res.status(201).json({ success: true, portfolio });
});

export const getPortfolio = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  let portfolios = await queryRecords('portfolios', (p) => p.studentId === (studentId || req.user.id));

  if (!portfolios.length) {
    return res.json({ success: true, portfolios: [], message: 'No portfolios found' });
  }

  // Enrich with items
  const enriched = await Promise.all(portfolios.map(async (portfolio) => {
    const items = await queryRecords('portfolio_items', (i) => i.portfolioId === portfolio.id);
    return { ...portfolio, items: items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
  }));

  res.json({ success: true, portfolios: enriched });
});

export const updatePortfolio = asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const { skills, objectives, academicYear } = req.body;

  const portfolio = await getRecord(`portfolios/${portfolioId}`);
  if (!portfolio) throw new ApiError(404, 'Portfolio not found');

  const updates = {
    ...(skills && { skills }),
    ...(objectives && { objectives }),
    ...(academicYear && { academicYear }),
    updatedAt: new Date().toISOString(),
  };

  await updateRecord(`portfolios/${portfolioId}`, updates);
  res.json({ success: true, portfolio: { ...portfolio, ...updates } });
});

export const addPortfolioItem = asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const { title, type, description, subject, tags, fileUrl } = req.body;

  // Handle file upload
  let attachmentUrl = fileUrl || null;
  if (req.file) {
    attachmentUrl = `/uploads/portfolio/${req.file.filename}`;
  }

  if (!title || !type) {
    throw new ApiError(400, 'Title and type are required');
  }

  const portfolio = await getRecord(`portfolios/${portfolioId}`);
  if (!portfolio) throw new ApiError(404, 'Portfolio not found');

  const itemId = Date.now().toString();
  const item = {
    id: itemId,
    portfolioId,
    title,
    type, // 'work_sample', 'certificate', 'project', 'reflection', 'assessment', 'award'
    description: description || '',
    subject: subject || null,
    tags: tags || [],
    attachmentUrl,
    graded: type === 'assessment',
    createdAt: new Date().toISOString(),
  };

  await createRecord(`portfolio_items/${itemId}`, item);

  // Update portfolio items count
  await updateRecord(`portfolios/${portfolioId}`, {
    totalAchievements: (portfolio.totalAchievements || 0) + 1,
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json({ success: true, item });
});

export const getPortfolioItems = asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const { type, subject } = req.query;

  let items = await queryRecords('portfolio_items', (i) => i.portfolioId === portfolioId);

  if (type) items = items.filter(i => i.type === type);
  if (subject) items = items.filter(i => i.subject === subject);

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, items });
});

export const deletePortfolioItem = asyncHandler(async (req, res) => {
  const { portfolioId, itemId } = req.params;

  const portfolio = await getRecord(`portfolios/${portfolioId}`);
  if (!portfolio) throw new ApiError(404, 'Portfolio not found');

  // Only allow deletion by owner, teacher, or admin
  if (portfolio.createdBy !== req.user.id && !['teacher', 'admin'].includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized');
  }

  await deleteRecord(`portfolio_items/${itemId}`);

  // Update portfolio count
  await updateRecord(`portfolios/${portfolioId}`, {
    totalAchievements: Math.max(0, (portfolio.totalAchievements || 1) - 1),
  });

  res.json({ success: true, message: 'Item deleted' });
});

export const exportPortfolio = asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;

  const portfolio = await getRecord(`portfolios/${portfolioId}`);
  if (!portfolio) throw new ApiError(404, 'Portfolio not found');

  const items = await queryRecords('portfolio_items', (i) => i.portfolioId === portfolioId);

  // Get student info
  const student = await getRecord(`student_profiles/${portfolio.studentId}`);
  const user = await getRecord(`users/${portfolio.studentId}`);

  const exportData = {
    student: {
      name: user?.name,
      email: user?.email,
      grade: student?.grade,
      section: student?.section,
    },
    portfolio: {
      academicYear: portfolio.academicYear,
      totalItems: items.length,
      skills: portfolio.skills,
      objectives: portfolio.objectives,
    },
    items: items.map(item => ({
      title: item.title,
      type: item.type,
      subject: item.subject,
      description: item.description,
      date: item.createdAt,
    })),
  };

  res.json({ success: true, export: exportData });
});