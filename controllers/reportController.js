import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import { getIO } from '../utils/socket.js';
import { generateId } from '../utils/generateId.js';

export const createReport = asyncHandler(async (req, res) => {
  const { type, severity, title, description, location, dateOfIncident, isAnonymous, evidenceUrls } = req.body;

  const reportId = generateId();
  const report = {
    id: reportId,
    type: type || 'other',
    severity: severity || 'medium',
    title,
    description,
    location: location || null,
    dateOfIncident: dateOfIncident || null,
    isAnonymous: isAnonymous || false,
    reportedBy: req.user.id,
    reportedByName: isAnonymous ? 'Anonymous' : req.user.name,
    status: 'under_review',
    notes: [],
    evidenceUrls: evidenceUrls || [],
    assignedTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createRecord(`reports/${reportId}`, report);

  // Emit real-time notification to admins/teachers
  const io = getIO();
  if (io) {
    io.emit('report:new', { title: report.title, severity: report.severity, id: reportId });
  }

  res.status(201).json({ success: true, report });
});

export const getReports = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;

  let reports = await getRecords('reports');

  // Students only see their own (non-anonymous) reports
  if (req.user.role === 'student') {
    reports = reports.filter(r => r.reportedBy === req.user.id || r.isAnonymous === false);
  }

  // Parents see their children's reports
  if (req.user.role === 'parent') {
    const parentProfile = await getRecord(`parent_profiles/${req.user.id}`);
    const childIds = parentProfile?.child_ids || [];
    reports = reports.filter(r => childIds.includes(r.reportedBy) || r.isAnonymous === false);
  }

  if (status) reports = reports.filter(r => r.status === status);
  if (type) reports = reports.filter(r => r.type === type);

  // Sort by date descending
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = reports.length;
  const skip = (page - 1) * limit;
  const paginated = reports.slice(skip, skip + limit);

  res.json({
    success: true,
    reports: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export const getReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const report = await getRecord(`reports/${reportId}`);

  if (!report) throw new ApiError(404, 'Report not found');

  // Students/parents can only see their own or non-anonymous
  if (['student', 'parent'].includes(req.user.role)) {
    if (report.reportedBy !== req.user.id && report.isAnonymous && report.status !== 'resolved') {
      throw new ApiError(403, 'Access denied');
    }
  }

  res.json({ success: true, report });
});

export const updateReportStatus = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status, notes } = req.body;

  const report = await getRecord(`reports/${reportId}`);
  if (!report) throw new ApiError(404, 'Report not found');

  const update = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (notes) {
    update.notes = [...(report.notes || []), {
      text: notes,
      by: req.user.name,
      role: req.user.role,
      at: new Date().toISOString(),
    }];
  }

  await updateRecord(`reports/${reportId}`, update);

  // Emit real-time update
  const io = getIO();
  if (io) {
    io.emit('report:status:updated', { reportId, status, notes });
  }

  res.json({ success: true, message: `Report status updated to ${status}` });
});