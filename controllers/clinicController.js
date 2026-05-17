import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import { getIO } from '../utils/socket.js';
import { generateId } from '../utils/generateId.js';

export const submitHealthRecord = asyncHandler(async (req, res) => {
  const { studentId, recordType, date, symptoms, diagnosis, treatment, medication, doctor, followUpDate, isEmergency, notes } = req.body;

  const recordId = generateId();
  const record = {
    id: recordId,
    studentId,
    recordType: recordType || 'visit',
    date,
    symptoms: symptoms || [],
    diagnosis: diagnosis || null,
    treatment: treatment || null,
    medication: medication || null,
    doctor: doctor || null,
    followUpDate: followUpDate || null,
    isEmergency: isEmergency || false,
    recordedBy: req.user.id,
    recordedByName: req.user.name,
    notes: notes || null,
    createdAt: new Date().toISOString(),
  };

  await createRecord(`health_records/${recordId}`, record);

  // If emergency, emit instant alert
  if (isEmergency) {
    const io = getIO();
    if (io) {
      // Get student info
      const student = await getRecord(`student_profiles/${studentId}`);
      const user = await getRecord(`users/${studentId}`);
      io.emit('clinic:emergency', {
        recordId,
        studentName: user?.name || 'Unknown',
        studentId,
        recordType,
        symptoms: symptoms || [],
        date,
      });
    }
  }

  res.status(201).json({ success: true, record });
});

export const getHealthRecords = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { startDate, endDate, recordType } = req.query;

  let records = await queryRecords('health_records', (r) => r.studentId === studentId);

  if (startDate) records = records.filter(r => r.date >= startDate);
  if (endDate) records = records.filter(r => r.date <= endDate);
  if (recordType) records = records.filter(r => r.recordType === recordType);

  records.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Enrich with student info
  const student = await getRecord(`student_profiles/${studentId}`);
  const user = await getRecord(`users/${studentId}`);

  res.json({
    success: true,
    records,
    student: {
      id: studentId,
      name: user?.name || 'Unknown',
      grade: student?.grade,
      section: student?.section,
    },
  });
});

export const sendClinicAlert = asyncHandler(async (req, res) => {
  const { title, message, severity, targetGroups, classId, requiresAction, actionDescription } = req.body;

  const alertId = generateId();
  const alert = {
    id: alertId,
    title,
    message,
    severity: severity || 'info',
    targetGroups: targetGroups || ['all'],
    classId: classId || null,
    requiresAction: requiresAction || false,
    actionDescription: actionDescription || null,
    issuedBy: req.user.id,
    issuedByName: req.user.name,
    readBy: [],
    createdAt: new Date().toISOString(),
  };

  await createRecord(`clinic_alerts/${alertId}`, alert);

  // Emit real-time alert
  const io = getIO();
  if (io) {
    if (targetGroups.includes('all') || targetGroups.includes('students')) {
      io.emit('clinic:alert', alert);
    }
    if (classId) {
      io.to(`class:${classId.replace('class-', '').toLowerCase()}`).emit('clinic:alert:class', alert);
    }
  }

  res.status(201).json({ success: true, alert });
});

export const getClinicAlerts = asyncHandler(async (req, res) => {
  const { severity, fromDate, toDate, page = 1, limit = 20 } = req.query;

  let alerts = await getRecords('clinic_alerts');

  if (severity) alerts = alerts.filter(a => a.severity === severity);
  if (fromDate) alerts = alerts.filter(a => a.createdAt >= fromDate);
  if (toDate) alerts = alerts.filter(a => a.createdAt <= toDate);

  alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = alerts.length;
  const skip = (page - 1) * limit;

  res.json({
    success: true,
    alerts: alerts.slice(skip, skip + limit),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export const getDashboard = asyncHandler(async (req, res) => {
  // Get all health records for summary
  const allRecords = await getRecords('health_records');
  const allAlerts = await getRecords('clinic_alerts');

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = allRecords.filter(r => r.date === today);
  const emergencyRecords = allRecords.filter(r => r.isEmergency);
  const activeAlerts = allAlerts.filter(a => ['warning', 'critical', 'emergency'].includes(a.severity));

  // Group records by type
  const byType = {};
  allRecords.forEach(r => {
    byType[r.recordType] = (byType[r.recordType] || 0) + 1;
  });

  // Get students with health conditions
  const allStudents = await getRecords('student_profiles');
  const studentsWithConditions = allStudents.filter(s => s.medical_conditions || s.allergies);

  res.json({
    success: true,
    dashboard: {
      today: {
        totalVisits: todayRecords.length,
        emergencies: todayRecords.filter(r => r.isEmergency).length,
        newAlerts: activeAlerts.length,
      },
      recordsByType: byType,
      totalEmergencies: emergencyRecords.length,
      totalStudentsWithConditions: studentsWithConditions.length,
      recentAlerts: activeAlerts.slice(0, 5),
    },
  });
});