import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import attendanceRoutes from './routes/attendance';
import schedulingRoutes from './routes/scheduling';
import sisRoutes from './routes/sis';
import examsRoutes from './routes/exams';
import classroomRoutes from './routes/classroom';
import financeRoutes from './routes/finance';
import hrRoutes from './routes/hr';
import libraryRoutes from './routes/library';
import commsRoutes from './routes/comms';
import erpRoutes from './routes/erp';
import studentsRoutes from './routes/students';
import calendarRoutes from './routes/calendar';
// Phase 3 Route Modules
import counsellingRoutes from './routes/counselling';
import healthRoutes from './routes/health';
import disciplineRoutes from './routes/discipline';
import activitiesRoutes from './routes/activities';
import portfolioRoutes from './routes/portfolio';
import enrolmentRoutes from './routes/enrolment';
// Phase 4 Route Modules 
import facilitiesRoutes from './routes/facilities';
import transportRoutes from './routes/transport';
import foodServiceRoutes from './routes/food-service';
import athleticsRoutes from './routes/athletics';
import alumniRoutes from './routes/alumni';
import platformRoutes from './routes/platform';
import circularRoutes from './routes/circulars';
import announcementRoutes from './routes/announcements';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Active bus GPS locations (busId -> { lat, lng, timestamp })
const busLocations = new Map<string, { lat: number; lng: number; timestamp: number }>();

// Route IDs whose driver is on leave today — their GPS broadcasts are ignored
// so a bus isn't tracked when its driver isn't working. Kept in memory for the
// hot socket path and rebuilt from Firebase via refreshTrackingDisabled().
const busTrackingDisabled = new Set<string>();

// Rebuild the on-leave route set from the driver `onLeave` flag in the database.
async function refreshTrackingDisabled(): Promise<void> {
  try {
    const [routesData, usersData] = await Promise.all([getData('routes'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const routes = routesData ? Object.values(routesData) as any[] : [];
    busTrackingDisabled.clear();
    for (const route of routes) {
      const driver = route?.driverId ? users[route.driverId] : null;
      if (driver?.onLeave) busTrackingDisabled.add(route.id);
    }
  } catch (err) {
    console.error('[Bus] refreshTrackingDisabled error:', err);
  }
}

// Seed a demo location for bus "r1" (assigned to driver Raju)
busLocations.set('r1', { lat: 17.3850, lng: 78.4867, timestamp: Date.now() });

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Driver sends GPS update
  socket.on('driver:location', (data: { busId: string; lat: number; lng: number }) => {
    // Ignore broadcasts for routes whose driver is on leave — no tracking when
    // the driver isn't working, even if a stale tab keeps emitting.
    if (busTrackingDisabled.has(data.busId)) return;
    const location = { lat: data.lat, lng: data.lng, timestamp: Date.now() };
    busLocations.set(data.busId, location);
    // Broadcast to all students watching this bus
    io.emit(`bus:location:${data.busId}`, location);
  });

  // Student requests current location for a bus
  socket.on('bus:subscribe', (busId: string) => {
    // Tell the subscriber the current service status so the UI can show
    // "no service today" without polling.
    socket.emit(`bus:status:${busId}`, { onLeave: busTrackingDisabled.has(busId) });
    if (busTrackingDisabled.has(busId)) return;
    const loc = busLocations.get(busId);
    if (loc) {
      socket.emit(`bus:location:${busId}`, loc);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const JWT_SECRET: string = process.env.JWT_SECRET || (() => {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
  return '';
})();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  credentials: true,
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`[Request Logger] Method: ${req.method}, Path: ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3001;

// Firebase RTDB REST API (credentials from environment)
const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://vnthhh-7b829-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

async function getData(path: string): Promise<any> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`);
    if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status} ${res.statusText}`);
    return res.json();
  } catch (err) {
    console.error(`[Firebase] getData(${path}) error:`, err);
    return null;
  }
}

async function setData(path: string, value: any): Promise<void> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[Firebase] setData(${path}) error:`, err);
  }
}

async function removeData(path: string): Promise<void> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[Firebase] removeData(${path}) error:`, err);
  }
}

app.use(express.json({ limit: '1mb' }));

// Sanitize request body to prevent prototype pollution
function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = sanitize(obj[key]);
  }
  return clean;
}
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Phase 1 + 2 Route Modules
app.use('/api/attendance', attendanceRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/sis', sisRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/comms', commsRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/students', studentsRoutes);

// Calendar
app.use('/api/calendar', calendarRoutes);

// Phase 3 Route Modules
app.use('/api/counselling', counsellingRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/enrolment', enrolmentRoutes);

// Phase 4 Route Modules
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/food-service', foodServiceRoutes);
app.use('/api/athletics', athleticsRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/circulars', circularRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/auth', authRoutes);
// Helper: safe user (remove password)
function safeUser(u: any) {
  if (!u) return null;
  const { password, ...safe } = u;
  return safe;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Cornerstone Backend', version: '4.0.0', timestamp: new Date().toISOString() });
});

// ==================== SEED DATA ====================
// Seed data
const toObj = (arr: any[]) => Object.fromEntries(arr.map((item: any) => [item.id, item]));
const buildSeedData = () => ({
  users: toObj([
    { id: "u1", name: "Aarav Sharma", email: "aarav@eduvault.ai", password: "demo1234", role: "student", class: "10-A", subjects: ["Math", "Physics", "Chemistry", "English", "CS"], gpa: 3.8, attendance: 92, feesPaid: true, routeId: "r1", avatar: "AS", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg", phone: "+91-9876543210", address: "42 Knowledge Park, New Delhi", dateOfBirth: "2008-06-15", admissionNo: "ADM-2024-001", rollNo: "1001", bloodGroup: "O+", aadharNo: "1234-5678-9012", penNo: "PEN-001", apaarId: "APAAR-001", religion: "Hindu", nationality: "Indian", schoolHouse: "Blue House", houseLocation: "Delhi NCR", fatherName: "Mr. Raj Sharma", fatherPhone: "+91-9876543211", motherName: "Mrs. Kavita Sharma", motherPhone: "+91-9876543212" },
    { id: "u2", name: "Priya Patel", email: "priya@eduvault.ai", password: "demo1234", role: "student", class: "10-A", subjects: ["Math", "Physics", "Chemistry", "English", "Biology"], gpa: 3.9, attendance: 96, feesPaid: true, routeId: "r1", avatar: "PP", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg", phone: "+91-9876543220", address: "15 Garden Colony, New Delhi", dateOfBirth: "2008-03-22", admissionNo: "ADM-2024-002", rollNo: "1002", bloodGroup: "A+", aadharNo: "2345-6789-0123", penNo: "PEN-002", apaarId: "APAAR-002", religion: "Hindu", nationality: "Indian", schoolHouse: "Green House", houseLocation: "Delhi NCR", fatherName: "Mr. Amit Patel", fatherPhone: "+91-9876543221", motherName: "Mrs. Neha Patel", motherPhone: "+91-9876543222" },
    { id: "u3", name: "Rohan Kumar", email: "rohan@eduvault.ai", password: "demo1234", role: "student", class: "10-B", subjects: ["Math", "Physics", "Chemistry", "English", "CS"], gpa: 3.5, attendance: 85, feesPaid: false, routeId: "r2", avatar: "RK", avatarUrl: "https://randomuser.me/api/portraits/men/51.jpg", phone: "+91-9876543230", address: "8 Sunshine Apartments, New Delhi", dateOfBirth: "2008-11-08", admissionNo: "ADM-2024-003", rollNo: "1003", bloodGroup: "B+", aadharNo: "3456-7890-1234", penNo: "PEN-003", apaarId: "APAAR-003", religion: "Hindu", nationality: "Indian", schoolHouse: "Red House", houseLocation: "Delhi NCR", fatherName: "Mr. Suresh Kumar", fatherPhone: "+91-9876543231", motherName: "Mrs. Poonam Kumar", motherPhone: "+91-9876543232" },
    { id: "u4", name: "Ananya Singh", email: "ananya@eduvault.ai", password: "demo1234", role: "student", class: "10-B", subjects: ["Math", "Physics", "Chemistry", "English", "Biology"], gpa: 3.7, attendance: 89, feesPaid: true, routeId: "r2", avatar: "AS", avatarUrl: "https://randomuser.me/api/portraits/women/53.jpg", phone: "+91-9876543240", address: "27 Royal Enclave, New Delhi", dateOfBirth: "2008-07-19", admissionNo: "ADM-2024-004", rollNo: "1004", bloodGroup: "AB+", aadharNo: "4567-8901-2345", penNo: "PEN-004", apaarId: "APAAR-004", religion: "Hindu", nationality: "Indian", schoolHouse: "Green House", houseLocation: "Delhi NCR", fatherName: "Mr. Vikram Singh", fatherPhone: "+91-9876543241", motherName: "Mrs. Anita Singh", motherPhone: "+91-9876543242" },
    { id: "u5", name: "Mr. Rajesh Gupta", email: "rajesh@eduvault.ai", password: "demo1234", role: "teacher", class: "10-A", subjects: ["Math", "Physics"] },
    { id: "u6", name: "Dr. Sunita Verma", email: "sunita@eduvault.ai", password: "demo1234", role: "teacher", class: "10-B", subjects: ["Chemistry", "Biology"] },
    { id: "u7", name: "Admin User", email: "admin@eduvault.ai", password: "admin123", role: "admin", avatar: "AU" },
    { id: "u8", name: "Mrs. Meera Kapoor", email: "meera@eduvault.ai", password: "demo1234", role: "admin" },
    { id: "u9", name: "Raju Kumar", email: "raju@eduvault.ai", password: "demo1234", role: "driver" }
  ]),
  timetable: {
    "10-A": [
      { day: "Monday", periods: [{ time: "8:00-8:45", subject: "Math" }, { time: "8:45-9:30", subject: "Physics" }, { time: "9:45-10:30", subject: "Chemistry" }, { time: "10:30-11:15", subject: "English" }, { time: "11:30-12:15", subject: "CS" }] },
      { day: "Tuesday", periods: [{ time: "8:00-8:45", subject: "English" }, { time: "8:45-9:30", subject: "Math" }, { time: "9:45-10:30", subject: "Physics" }, { time: "10:30-11:15", subject: "Chemistry" }, { time: "11:30-12:15", subject: "CS" }] },
      { day: "Wednesday", periods: [{ time: "8:00-8:45", subject: "Chemistry" }, { time: "8:45-9:30", subject: "English" }, { time: "9:45-10:30", subject: "Math" }, { time: "10:30-11:15", subject: "CS" }, { time: "11:30-12:15", subject: "Physics" }] },
      { day: "Thursday", periods: [{ time: "8:00-8:45", subject: "Physics" }, { time: "8:45-9:30", subject: "CS" }, { time: "9:45-10:30", subject: "English" }, { time: "10:30-11:15", subject: "Math" }, { time: "11:30-12:15", subject: "Chemistry" }] },
      { day: "Friday", periods: [{ time: "8:00-8:45", subject: "CS" }, { time: "8:45-9:30", subject: "Chemistry" }, { time: "9:45-10:30", subject: "Math" }, { time: "10:30-11:15", subject: "Physics" }, { time: "11:30-12:15", subject: "English" }] }
    ],
    "10-B": [
      { day: "Monday", periods: [{ time: "8:00-8:45", subject: "Math" }, { time: "8:45-9:30", subject: "Chemistry" }, { time: "9:45-10:30", subject: "English" }, { time: "10:30-11:15", subject: "Physics" }, { time: "11:30-12:15", subject: "Biology" }] },
      { day: "Tuesday", periods: [{ time: "8:00-8:45", subject: "Biology" }, { time: "8:45-9:30", subject: "Math" }, { time: "9:45-10:30", subject: "Chemistry" }, { time: "10:30-11:15", subject: "English" }, { time: "11:30-12:15", subject: "Physics" }] },
      { day: "Wednesday", periods: [{ time: "8:00-8:45", subject: "English" }, { time: "8:45-9:30", subject: "Physics" }, { time: "9:45-10:30", subject: "Biology" }, { time: "10:30-11:15", subject: "Math" }, { time: "11:30-12:15", subject: "Chemistry" }] },
      { day: "Thursday", periods: [{ time: "8:00-8:45", subject: "Chemistry" }, { time: "8:45-9:30", subject: "Biology" }, { time: "9:45-10:30", subject: "Math" }, { time: "10:30-11:15", subject: "English" }, { time: "11:30-12:15", subject: "Physics" }] },
      { day: "Friday", periods: [{ time: "8:00-8:45", subject: "Physics" }, { time: "8:45-9:30", subject: "English" }, { time: "9:45-10:30", subject: "Chemistry" }, { time: "10:30-11:15", subject: "Biology" }, { time: "11:30-12:15", subject: "Math" }] }
    ]
  },
  routes: toObj([
    { id: "r1", name: "Route A - North Campus", driver: "Raju Kumar", driverId: "u9", bus: "KA-01-1234", stops: ["Main Gate", "North Block", "Library", "Sports Complex"], students: ["u1", "u2"] },
    { id: "r2", name: "Route B - South Campus", driver: "Raju Kumar", driverId: "u9", bus: "KA-01-5678", stops: ["South Gate", "Auditorium", "Lab Block", "Cafeteria"], students: ["u3", "u4"] }
  ]),
  events: toObj([
    { id: "e1", title: "Annual Sports Day", date: "2026-06-15", type: "sports", description: "Inter-house athletics competition" },
    { id: "e2", title: "Science Fair", date: "2026-06-22", type: "academic", description: "Student science project exhibition" },
    { id: "e3", title: "Parent-Teacher Meeting", date: "2026-05-30", type: "meeting", description: "Quarterly PTM for all classes" },
    { id: "e4", title: "Farewell Ceremony", date: "2026-05-20", type: "ceremony", description: "Farewell for graduating batch" }
  ]),
  clubs: toObj([
    {
      id: "c1", name: "Coding Club", description: "Learn programming, build projects, compete in hackathons", members: ["u1", "u3"], lead: "u1", leadName: "Aarav Sharma", avatar: "https://randomuser.me/api/portraits/men/32.jpg", category: "Technology", meetingDay: "Wednesday", meetingTime: "3:30 PM", posts: [
        { id: "p1", authorId: "u1", authorName: "Aarav Sharma", avatar: "https://randomuser.me/api/portraits/men/32.jpg", content: "Great hackathon session today! 🚀", timestamp: "2026-05-19T15:00:00Z", likes: ["u3", "u5"] },
        { id: "p2", authorId: "u3", authorName: "Rohan Kumar", avatar: "https://randomuser.me/api/portraits/men/51.jpg", content: "Just finished my first React app!", timestamp: "2026-05-18T14:00:00Z", likes: ["u1"] }
      ]
    },
    {
      id: "c2", name: "Science Society", description: "Explore scientific concepts through experiments and research", members: ["u2", "u4"], lead: "u2", leadName: "Priya Patel", avatar: "https://randomuser.me/api/portraits/women/68.jpg", category: "Academic", meetingDay: "Thursday", meetingTime: "4:00 PM", posts: [
        { id: "p3", authorId: "u2", authorName: "Priya Patel", avatar: "https://randomuser.me/api/portraits/women/68.jpg", content: "Science fair prep going well! 🧪", timestamp: "2026-05-19T16:00:00Z", likes: ["u4", "u6"] }
      ]
    },
    {
      id: "c3", name: "Drama Club", description: "Acting, stagecraft, and theatrical productions", members: ["u1", "u2", "u4"], lead: "u4", leadName: "Ananya Singh", avatar: "https://randomuser.me/api/portraits/women/53.jpg", category: "Arts", meetingDay: "Friday", meetingTime: "3:00 PM", posts: [
        { id: "p4", authorId: "u4", authorName: "Ananya Singh", avatar: "https://randomuser.me/api/portraits/women/53.jpg", content: "Auditions for the spring play next week! 🎭", timestamp: "2026-05-20T10:00:00Z", likes: ["u1", "u2"] }
      ]
    },
    { id: "c4", name: "Music Ensemble", description: "Band, choir, and individual music performance", members: ["u1", "u2", "u3", "u4"], lead: "u2", leadName: "Priya Patel", avatar: "https://randomuser.me/api/portraits/women/68.jpg", category: "Arts", meetingDay: "Tuesday", meetingTime: "3:30 PM", posts: [] },
    { id: "c5", name: "Sports Club", description: "Athletics, team sports, and fitness activities", members: ["u1", "u3"], lead: "u3", leadName: "Rohan Kumar", avatar: "https://randomuser.me/api/portraits/men/51.jpg", category: "Sports", meetingDay: "Monday", meetingTime: "4:00 PM", posts: [] },
    { id: "c6", name: "Debate Society", description: "Public speaking, argumentation, and competitive debate", members: ["u2", "u4"], lead: "u4", leadName: "Ananya Singh", avatar: "https://randomuser.me/api/portraits/women/53.jpg", category: "Academic", meetingDay: "Wednesday", meetingTime: "4:30 PM", posts: [] },
    { id: "c7", name: "Art Studio", description: "Painting, sculpture, and digital art creation", members: ["u1", "u2", "u4"], lead: "u1", leadName: "Aarav Sharma", avatar: "https://randomuser.me/api/portraits/men/32.jpg", category: "Arts", meetingDay: "Thursday", meetingTime: "3:00 PM", posts: [] },
    { id: "c8", name: "Robotics Club", description: "Build and program robots for competitions", members: ["u1", "u3"], lead: "u1", leadName: "Aarav Sharma", avatar: "https://randomuser.me/api/portraits/men/32.jpg", category: "Technology", meetingDay: "Friday", meetingTime: "4:00 PM", posts: [] }
  ]),
  assignments: toObj([
    { id: "a1", title: "Quadratic Equations", subjectId: "sub1", subject: "Mathematics", class: "10-A", dueDate: "2026-05-05", status: "active", description: "Solve 20 quadratic equations", maxMarks: 50, submissions: [] },
    { id: "a2", title: "Newton's Laws Essay", subjectId: "sub2", subject: "Physics", class: "10-A", dueDate: "2026-05-10", status: "active", description: "Write an essay on Newton's three laws", maxMarks: 30, submissions: [] },
    { id: "a3", title: "Organic Chemistry Basics", subjectId: "sub3", subject: "Chemistry", class: "10-A", dueDate: "2026-05-12", status: "active", description: "Complete the worksheet", maxMarks: 40, submissions: [] },
    { id: "a4", title: "Essay: Climate Change", subjectId: "sub4", subject: "English", class: "10-A", dueDate: "2026-05-15", status: "active", description: "Write a 500-word essay", maxMarks: 25, submissions: [] },
    { id: "a5", title: "HTML Basics Project", subjectId: "sub5", subject: "CS", class: "10-A", dueDate: "2026-05-08", status: "active", description: "Create a personal webpage", maxMarks: 50, submissions: [] },
    { id: "a6", title: "Quadratic Equations", subjectId: "sub1", subject: "Mathematics", class: "10-B", dueDate: "2026-05-05", status: "active", description: "Solve 20 quadratic equations", maxMarks: 50, submissions: [] },
    { id: "a7", title: "Shakespeare Analysis", subjectId: "sub4", subject: "English", class: "10-B", dueDate: "2026-05-10", status: "completed", description: "Analyze Hamlet's soliloquy", maxMarks: 40, submissions: [{ studentId: "u3", content: "Analysis submitted", scoredMarks: 35, feedback: "Well written", submittedAt: "2026-05-09T16:00:00Z" }, { studentId: "u4", content: "Done", scoredMarks: 38, feedback: "Excellent analysis", submittedAt: "2026-05-09T14:00:00Z" }] },
    { id: "a8", title: "Trigonometry Problems", subjectId: "sub1", subject: "Mathematics", class: "10-B", dueDate: "2026-05-08", status: "completed", description: "Solve trigonometric identities", maxMarks: 50, submissions: [{ studentId: "u3", content: "Completed", scoredMarks: 40, feedback: "Good work", submittedAt: "2026-05-07T12:00:00Z" }, { studentId: "u4", content: "Done", scoredMarks: 46, feedback: "Excellent", submittedAt: "2026-05-07T11:00:00Z" }] }
  ]),
  grades: {
    u1: [
      { subject: "Math", overall: 92, marks: 92, midTerm: 45, finalTerm: 47, grade: "A", trend: "up" },
      { subject: "Physics", overall: 88, marks: 88, midTerm: 42, finalTerm: 46, grade: "A-", trend: "up" },
      { subject: "Chemistry", overall: 82, marks: 82, midTerm: 40, finalTerm: 42, grade: "B+", trend: "down" },
      { subject: "English", overall: 90, marks: 90, midTerm: 44, finalTerm: 46, grade: "A", trend: "up" },
      { subject: "CS", overall: 96, marks: 96, midTerm: 48, finalTerm: 48, grade: "A+", trend: "up" }
    ],
    u2: [
      { subject: "Math", overall: 95, marks: 95, midTerm: 47, finalTerm: 48, grade: "A+", trend: "up" },
      { subject: "Physics", overall: 91, marks: 91, midTerm: 45, finalTerm: 46, grade: "A", trend: "up" },
      { subject: "Chemistry", overall: 89, marks: 89, midTerm: 44, finalTerm: 45, grade: "A", trend: "up" },
      { subject: "English", overall: 94, marks: 94, midTerm: 47, finalTerm: 47, grade: "A+", trend: "up" },
      { subject: "Biology", overall: 90, marks: 90, midTerm: 45, finalTerm: 45, grade: "A", trend: "down" }
    ],
    u3: [
      { subject: "Math", overall: 78, marks: 78, midTerm: 38, finalTerm: 40, grade: "B+", trend: "down" },
      { subject: "Physics", overall: 72, marks: 72, midTerm: 35, finalTerm: 37, grade: "B", trend: "down" },
      { subject: "Chemistry", overall: 85, marks: 85, midTerm: 42, finalTerm: 43, grade: "A-", trend: "up" },
      { subject: "English", overall: 79, marks: 79, midTerm: 39, finalTerm: 40, grade: "B+", trend: "up" },
      { subject: "CS", overall: 86, marks: 86, midTerm: 43, finalTerm: 43, grade: "A-", trend: "up" }
    ],
    u4: [
      { subject: "Math", overall: 87, marks: 87, midTerm: 43, finalTerm: 44, grade: "A-", trend: "down" },
      { subject: "Physics", overall: 80, marks: 80, midTerm: 40, finalTerm: 40, grade: "B+", trend: "up" },
      { subject: "Chemistry", overall: 88, marks: 88, midTerm: 44, finalTerm: 44, grade: "A", trend: "up" },
      { subject: "English", overall: 91, marks: 91, midTerm: 45, finalTerm: 46, grade: "A", trend: "up" },
      { subject: "Biology", overall: 93, marks: 93, midTerm: 46, finalTerm: 47, grade: "A+", trend: "up" }
    ]
  },
  attendance: {
    u1: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "absent" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }],
    u2: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "present" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }],
    u3: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "absent" }, { date: "2026-05-03", status: "absent" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "late" }],
    u4: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "late" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }]
  },
  subjects: toObj([
    { id: "sub1", name: "Mathematics", code: "MTH10", credits: 5, classes: ["10-A", "10-B"] },
    { id: "sub2", name: "Physics", code: "PHY10", credits: 4, classes: ["10-A", "10-B"] },
    { id: "sub3", name: "Chemistry", code: "CHM10", credits: 4, classes: ["10-A"] },
    { id: "sub4", name: "English", code: "ENG10", credits: 3, classes: ["10-A", "10-B"] },
    { id: "sub5", name: "Computer Science", code: "CSC10", credits: 4, classes: ["10-A"] },
    { id: "sub6", name: "Biology", code: "BIO10", credits: 4, classes: ["10-B"] }
  ]),
  fees: {
    u1: [{ type: "tuition", amount: 50000, paid: 50000, due: "2026-01-15", status: "paid" }, { type: "lab", amount: 10000, paid: 5000, due: "2026-03-15", status: "partial" }, { type: "sports", amount: 5000, paid: 5000, due: "2026-04-01", status: "paid" }],
    u2: [{ type: "tuition", amount: 50000, paid: 50000, due: "2026-01-15", status: "paid" }, { type: "lab", amount: 10000, paid: 10000, due: "2026-03-15", status: "paid" }, { type: "library", amount: 3000, paid: 0, due: "2026-05-01", status: "unpaid" }],
    u3: [{ type: "tuition", amount: 45000, paid: 45000, due: "2026-01-15", status: "paid" }, { type: "lab", amount: 8000, paid: 0, due: "2026-03-15", status: "unpaid" }, { type: "transport", amount: 12000, paid: 12000, due: "2026-04-01", status: "paid" }],
    u4: [{ type: "tuition", amount: 45000, paid: 45000, due: "2026-01-15", status: "paid" }, { type: "lab", amount: 8000, paid: 8000, due: "2026-03-15", status: "paid" }]
  },
  feeRecords: toObj([
    { id: "fr1", studentId: "u1", studentName: "Aarav Sharma", class: "10-A", type: "tuition", amount: 50000, paid: 50000, due: "2026-01-15", status: "paid" },
    { id: "fr2", studentId: "u2", studentName: "Priya Patel", class: "10-A", type: "tuition", amount: 50000, paid: 50000, due: "2026-01-15", status: "paid" },
    { id: "fr3", studentId: "u3", studentName: "Rohan Kumar", class: "10-B", type: "tuition", amount: 45000, paid: 45000, due: "2026-01-15", status: "paid" },
    { id: "fr4", studentId: "u4", studentName: "Ananya Singh", class: "10-B", type: "tuition", amount: 45000, paid: 45000, due: "2026-01-15", status: "paid" }
  ]),
  messages: {
    u1: [
      { id: "m1", from: "u5", to: "u1", content: "Great work on your math assignment, Aarav!", timestamp: "2026-05-29T10:30:00Z", read: true },
      { id: "m2", from: "u7", to: "u1", content: "Please submit your fee receipt by Friday.", timestamp: "2026-05-28T09:00:00Z", read: true },
      { id: "m3", from: "u5", to: "u1", content: "Reminder: Physics practical tomorrow at 9 AM.", timestamp: "2026-05-27T14:00:00Z", read: false }
    ],
    u2: [
      { id: "m4", from: "u6", to: "u2", content: "Excellent biology project, Priya!", timestamp: "2026-05-29T11:00:00Z", read: true }
    ],
    u3: [
      { id: "m5", from: "u5", to: "u3", content: "Please complete your pending math homework.", timestamp: "2026-05-29T08:00:00Z", read: false }
    ],
    u4: [
      { id: "m6", from: "u6", to: "u4", content: "Great participation in science society meeting.", timestamp: "2026-05-28T15:00:00Z", read: true }
    ]
  },
  notifications: {
    u1: [
      { id: "n1", title: "Assignment Graded", message: "Your Math assignment has been graded.", type: "grade", read: false, createdAt: "2026-05-30T10:00:00Z" },
      { id: "n2", title: "Exam Schedule", message: "Mid-term exams start next week.", type: "exam", read: false, createdAt: "2026-05-29T09:00:00Z" }
    ],
    u2: [
      { id: "n3", title: "Club Meeting", message: "Science society meeting at 4 PM.", type: "club", read: false, createdAt: "2026-05-30T08:00:00Z" }
    ]
  },
  announcements: toObj([
    { id: "ann1", title: "Summer Break Notice", content: "School will remain closed for summer break from June 15 to July 10.", priority: "high", audience: ["all"], createdBy: "u7", createdAt: "2026-06-01T08:00:00Z" },
    { id: "ann2", title: "Parent-Teacher Meeting", content: "Quarterly PTM scheduled for June 25. All parents are requested to attend.", priority: "medium", audience: ["all"], createdBy: "u7", createdAt: "2026-06-05T10:00:00Z" },
    { id: "ann3", title: "Science Fair Winners", content: "Congratulations to all winners of the inter-school science fair!", priority: "low", audience: ["students"], createdBy: "u5", createdAt: "2026-06-10T09:00:00Z" }
  ]),
  attendancePolicies: toObj([
    { id: "ap1", name: "Standard Absence Policy", maxAbsentDays: 20, gracePeriod: 3, requireParentNote: true, academicYear: "2025-26" },
    { id: "ap2", name: "Exam Attendance Policy", maxAbsentDays: 0, requireMedicalCert: true, academicYear: "2025-26" }
  ]),
  bellSchedules: toObj([
    { id: "bs1", name: "Regular Day", startTime: "08:00", endTime: "15:30", periods: 8, periodDuration: 40, breakStart: "10:25", breakDuration: 20, lunchStart: "12:20", lunchDuration: 40 },
    { id: "bs2", name: "Short Day", startTime: "08:00", endTime: "13:00", periods: 6, periodDuration: 35, breakStart: "10:00", breakDuration: 15, lunchStart: "12:00", lunchDuration: 30 }
  ]),
  roomBookings: toObj([
    { id: "rb1", room: "Lab 1", date: "2026-06-01", startTime: "09:00", endTime: "10:30", bookedBy: "u5", purpose: "Physics practical", status: "confirmed" },
    { id: "rb2", room: "IT Lab", date: "2026-06-02", startTime: "11:00", endTime: "12:30", bookedBy: "u5", purpose: "CS class 10-A", status: "confirmed" }
  ]),
  lessonPlans: toObj([
    { id: "lp1", title: "Quadratic Equations - Introduction", subjectId: "sub1", class: "10-A", teacherId: "u5", week: 1, objectives: ["Understand standard form", "Solve by factorization"], resources: ["Textbook Ch5", "Worksheet 1"], status: "completed" },
    { id: "lp2", title: "Newton's Laws - Lab Session", subjectId: "sub2", class: "10-A", teacherId: "u5", week: 2, objectives: ["Verify F=ma", "Measure acceleration"], resources: ["Lab equipment", "Data sheet"], status: "active" }
  ]),
  exercises: toObj([
    { id: "ex1", title: "Algebra Basics", subjectId: "sub1", class: "10-A", questions: [
      { id: "eq1", question: "Solve 2x + 5 = 13", type: "short", answer: "x = 4" },
      { id: "eq2", question: "Factorize x² - 9", type: "short", answer: "(x-3)(x+3)" }
    ], maxScore: 10 },
    { id: "ex2", title: "Physics Numericals", subjectId: "sub2", class: "10-A", questions: [
      { id: "eq3", question: "A force of 10N accelerates a 2kg mass. Find acceleration", type: "short", answer: "5 m/s²" }
    ], maxScore: 5 }
  ]),
  exams: toObj([
    { id: "exam1", title: "Mid Term Mathematics", subjectId: "sub1", class: "10-A", date: "2026-05-20", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Mathematics - Algebra and Geometry" },
    { id: "exam2", title: "Mid Term Physics", subjectId: "sub2", class: "10-A", date: "2026-05-22", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Physics - Mechanics" },
    { id: "exam3", title: "Mid Term English", subjectId: "sub4", class: "10-A", date: "2026-05-24", totalMarks: 80, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for English - Grammar and Literature" },
    { id: "exam4", title: "Mid Term Chemistry", subjectId: "sub3", class: "10-A", date: "2026-05-21", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Chemistry" },
    { id: "exam5", title: "Mid Term CS", subjectId: "sub5", class: "10-A", date: "2026-05-23", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Computer Science" },
    { id: "exam6", title: "Mid Term Mathematics", subjectId: "sub1", class: "10-B", date: "2026-05-20", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Mathematics" },
    { id: "exam7", title: "Mid Term Physics", subjectId: "sub2", class: "10-B", date: "2026-05-22", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Physics" },
    { id: "exam8", title: "Mid Term English", subjectId: "sub4", class: "10-B", date: "2026-05-24", totalMarks: 80, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for English" },
    { id: "exam9", title: "Mid Term Biology", subjectId: "sub6", class: "10-B", date: "2026-05-23", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Biology" },
    { id: "exam10", title: "Mid Term Chemistry", subjectId: "sub3", class: "10-B", date: "2026-05-21", totalMarks: 100, type: "midterm", status: "completed", resultStatus: "published", description: "Mid term examination for Chemistry" }
  ]),
  examResults: {
    exam1: {
      u1: { studentId: "u1", marks: 92, grade: "A", remarks: "Excellent work", enteredBy: "u5", enteredAt: "2026-05-21T10:00:00Z", status: "published" },
      u2: { studentId: "u2", marks: 95, grade: "A+", remarks: "Outstanding", enteredBy: "u5", enteredAt: "2026-05-21T10:00:00Z", status: "published" }
    },
    exam2: {
      u1: { studentId: "u1", marks: 88, grade: "A-", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-23T10:00:00Z", status: "published" },
      u2: { studentId: "u2", marks: 91, grade: "A", remarks: "Very good", enteredBy: "u5", enteredAt: "2026-05-23T10:00:00Z", status: "published" }
    },
    exam3: {
      u1: { studentId: "u1", marks: 72, grade: "A", remarks: "Good grammar", enteredBy: "u5", enteredAt: "2026-05-25T10:00:00Z", status: "published" },
      u2: { studentId: "u2", marks: 75, grade: "A+", remarks: "Excellent", enteredBy: "u5", enteredAt: "2026-05-25T10:00:00Z", status: "published" }
    },
    exam4: {
      u1: { studentId: "u1", marks: 82, grade: "B+", remarks: "Needs improvement in organic", enteredBy: "u5", enteredAt: "2026-05-22T10:00:00Z", status: "published" },
      u2: { studentId: "u2", marks: 89, grade: "A", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-22T10:00:00Z", status: "published" }
    },
    exam5: {
      u1: { studentId: "u1", marks: 96, grade: "A+", remarks: "Excellent programmer", enteredBy: "u5", enteredAt: "2026-05-24T10:00:00Z", status: "published" }
    },
    exam6: {
      u3: { studentId: "u3", marks: 78, grade: "B+", remarks: "Fair", enteredBy: "u5", enteredAt: "2026-05-21T10:00:00Z", status: "published" },
      u4: { studentId: "u4", marks: 87, grade: "A-", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-21T10:00:00Z", status: "published" }
    },
    exam7: {
      u3: { studentId: "u3", marks: 72, grade: "B", remarks: "Needs practice", enteredBy: "u5", enteredAt: "2026-05-23T10:00:00Z", status: "published" },
      u4: { studentId: "u4", marks: 80, grade: "B+", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-23T10:00:00Z", status: "published" }
    },
    exam8: {
      u3: { studentId: "u3", marks: 63, grade: "B+", remarks: "Good essay", enteredBy: "u5", enteredAt: "2026-05-25T10:00:00Z", status: "published" },
      u4: { studentId: "u4", marks: 73, grade: "A", remarks: "Excellent analysis", enteredBy: "u5", enteredAt: "2026-05-25T10:00:00Z", status: "published" }
    },
    exam9: {
      u3: { studentId: "u3", marks: 86, grade: "A-", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-24T10:00:00Z", status: "published" },
      u4: { studentId: "u4", marks: 93, grade: "A+", remarks: "Outstanding", enteredBy: "u5", enteredAt: "2026-05-24T10:00:00Z", status: "published" }
    },
    exam10: {
      u3: { studentId: "u3", marks: 85, grade: "A-", remarks: "Good", enteredBy: "u5", enteredAt: "2026-05-22T10:00:00Z", status: "published" },
      u4: { studentId: "u4", marks: 88, grade: "A", remarks: "Very good", enteredBy: "u5", enteredAt: "2026-05-22T10:00:00Z", status: "published" }
    }
  },
  chartOfAccounts: toObj([
    { id: "coa1", code: "1000", name: "Cash", type: "asset", normalBalance: "debit" },
    { id: "coa2", code: "2000", name: "Accounts Receivable", type: "asset", normalBalance: "debit" },
    { id: "coa3", code: "3000", name: "Tuition Revenue", type: "revenue", normalBalance: "credit" },
    { id: "coa4", code: "4000", name: "Salary Expense", type: "expense", normalBalance: "debit" },
    { id: "coa5", code: "5000", name: "Accounts Payable", type: "liability", normalBalance: "credit" }
  ]),
  budgets: toObj([
    { id: "bd1", name: "Annual Academic Budget 2025-26", fiscalYear: "2025-26", totalAmount: 5000000, allocated: 3200000, remaining: 1800000, status: "active", items: [
      { category: "Salaries", amount: 3000000, spent: 2500000 },
      { category: "Lab Equipment", amount: 500000, spent: 200000 },
      { category: "Library", amount: 300000, spent: 100000 }
    ] }
  ]),
  invoices: toObj([
    { id: "inv1", invoiceNumber: "INV-2026-001", studentId: "u3", studentName: "Rohan Kumar", items: [
      { description: "Term 3 Tuition Fee", amount: 25000 },
      { description: "Lab Fee", amount: 5000 },
      { description: "Library Fee", amount: 2000 }
    ], subtotal: 32000, tax: 0, total: 32000, status: "pending", dueDate: "2026-07-31", issuedDate: "2026-07-01", paidAmount: 0 }
  ]),
  payments: toObj([
    { id: "pmt1", invoiceId: "inv1", studentId: "u1", amount: 50000, method: "online", transactionId: "txn_001", status: "completed", date: "2026-01-15", term: "Term 1" },
    { id: "pmt2", invoiceId: "inv2", studentId: "u2", amount: 50000, method: "bank", transactionId: "txn_002", status: "completed", date: "2026-01-20", term: "Term 1" }
  ]),
  expenses: toObj([
    { id: "exp1", description: "Lab equipment purchase", category: "Lab Equipment", amount: 50000, date: "2026-06-01", paidTo: "Scientific Supplies Co.", paymentMethod: "bank", approvedBy: "u7", status: "approved" },
    { id: "exp2", description: "Classroom whiteboard replacement", category: "Supplies", amount: 12000, date: "2026-06-10", paidTo: "School Supplies Ltd.", paymentMethod: "cash", status: "pending" },
    { id: "exp3", description: "Bus maintenance - Route A", category: "Transport", amount: 8500, date: "2026-06-12", paidTo: "Auto Service Center", paymentMethod: "bank", status: "pending" }
  ]),
  bookCatalogue: toObj([
    { id: "bk1", title: "Introduction to Algorithms", author: "CLRS", isbn: "978-0-262-04630-5", category: "Computer Science", copies: 3, available: 2, shelf: "CS-01" },
    { id: "bk2", title: "Organic Chemistry", author: "Morrison & Boyd", isbn: "978-0-13-404228-2", category: "Chemistry", copies: 2, available: 1, shelf: "CH-03" },
    { id: "bk3", title: "University Physics", author: "Young & Freedman", isbn: "978-0-321-69686-1", category: "Physics", copies: 4, available: 3, shelf: "PH-02" }
  ]),
  disciplineRecords: toObj([]),
  healthRecords: toObj([]),
  counsellingRecords: toObj([]),
  activityRecords: toObj([]),
  portfolioRecords: toObj([]),
  enrolmentRecords: toObj([]),
  libraryRecords: toObj([]),
  cautionDeposits: toObj([]),
  diplomaManagement: toObj([]),
  studentServices: toObj([]),
  leads: toObj([
    { id: "ld1", name: "Mr. Sharma", email: "sharma@example.com", phone: "+91-9999888777", source: "referral", status: "new", notes: "Interested in Class 11 admission for his son", createdAt: "2026-05-20T10:00:00Z" }
  ]),
  products: toObj([
    { id: "pr1", name: "School Uniform - Junior", sku: "UNI-JR-001", price: 1500, unit: "set", category: "uniform", stock: 50 },
    { id: "pr2", name: "Textbook - Mathematics Grade 10", sku: "TXT-M10-001", price: 800, unit: "piece", category: "textbook", stock: 100 }
  ]),
  orders: toObj([
    { id: "or1", orderNumber: "ORD-2026-001", clientId: "cl1", status: "pending", items: [{ productId: "pr2", quantity: 30, unitPrice: 800 }], total: 24000, orderDate: "2026-06-01", expectedDelivery: "2026-06-15" }
  ]),
  staffDirectory: toObj([
    { id: "sd1", firstName: "Rajesh", lastName: "Gupta", department: "Science", position: "Senior Teacher", employeeId: "EMP001", joinDate: "2020-04-01", qualification: "Ph.D. Physics", userId: "u5" },
    { id: "sd2", firstName: "Sunita", lastName: "Verma", department: "Science", position: "Professor", employeeId: "EMP002", joinDate: "2019-08-15", qualification: "Ph.D. Chemistry", userId: "u6" }
  ]),
  staffPositions: toObj([
    { id: "sp1", title: "Senior Teacher", department: "Science", salaryRange: { min: 60000, max: 90000 }, requirements: ["Ph.D.", "5+ years experience"] },
    { id: "sp2", title: "Professor", department: "Science", salaryRange: { min: 70000, max: 110000 }, requirements: ["Ph.D.", "8+ years experience"] }
  ])
});

async function seedDatabase() {
  console.log('[Seed] Checking if database is populated...');
  const existing = await getData('users');
  if (existing && Object.keys(existing).length > 0) {
    console.log(`[Seed] Database already has ${Object.keys(existing).length} users — skipping seed.`);
    return;
  }
  console.log('[Seed] Starting fresh database seed...');
  const data = buildSeedData();
  const users = data.users as any;
  if (users) {
    for (const key of Object.keys(users)) {
      const pwd = users[key].password;
      if (pwd && !pwd.startsWith('$2')) {
        users[key].password = await bcrypt.hash(pwd, SALT_ROUNDS);
      }
    }
  }
  await setData('/', data);
  console.log('[Seed] Database seeded SUCCESSFULLY!');
}

app.all('/api/seed', authMiddleware, async (req, res) => {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const force = req.query.force === 'true';
    if (force) {
      console.log('[Seed] Force reseeding...');
      const data = buildSeedData();
      const users = data.users as any;
      if (users) {
        for (const key of Object.keys(users)) {
          const pwd = users[key].password;
          if (pwd && !pwd.startsWith('$2')) {
            users[key].password = await bcrypt.hash(pwd, SALT_ROUNDS);
          }
        }
      }
      await setData('/', data);
      return res.json({ success: true, message: 'Database force-seeded' });
    }
    const existing = await getData('users');
    if (existing && Object.keys(existing).length > 0) {
      return res.json({ success: true, message: 'Database already has data, use ?force=true to reseed' });
    }
    await seedDatabase();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('[Seed] Seed error:', error);
    res.status(500).json({ error: 'Seed failed' });
  }
});



// ==================== AUTH ====================
const SALT_ROUNDS = 10;

function signToken(user: any): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ==================== USERS ====================
app.get('/api/users', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const { role, class: className } = req.query;
    let users = usersData ? Object.values(usersData) : [];
    users = users.map(safeUser);
    if (role) users = users.filter((u: any) => u.role === role);
    if (className) users = users.filter((u: any) => u.class === className);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getData(`users/${req.params.id}`);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;
    const newUser = { id: `u${Date.now()}`, ...rest, password: hashedPassword };
    await setData(`users/${newUser.id}`, newUser);
    res.status(201).json(safeUser(newUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const existing = await getData(`users/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const { password, ...rest } = req.body;
    const updated = { ...existing, ...rest };
    if (password) {
      updated.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    await setData(`users/${req.params.id}`, updated);
    res.json(safeUser(updated));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await removeData(`users/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== STUDENTS ====================
app.get('/api/students', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const { class: className } = req.query;
    let students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student') : [];
    if (className) students = students.filter((u: any) => u.class === className);
    res.json(students.map(safeUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const user = await getData(`users/${req.params.id}`);
    if (!user || user.role !== 'student') return res.status(404).json({ error: 'Student not found' });
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

app.get('/api/students/:id/grades', async (req, res) => {
  try {
    const grades = await getData(`grades/${req.params.id}`);
    res.json(grades || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

app.get('/api/students/:id/attendance', async (req, res) => {
  try {
    const attendance = await getData(`attendance/${req.params.id}`);
    res.json(attendance || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

app.get('/api/students/:id/fees', async (req, res) => {
  try {
    const fees = await getData(`fees/${req.params.id}`);
    res.json(fees || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

app.get('/api/students/:id/goals', async (req, res) => {
  try {
    const goals = await getData(`goals/${req.params.id}`);
    res.json(goals || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

app.post('/api/students/:id/goals', async (req, res) => {
  try {
    const goal = { id: `g${Date.now()}`, ...req.body };
    await setData(`goals/${req.params.id}/${goal.id}`, goal);
    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

app.put('/api/students/:id/goals/:goalId', async (req, res) => {
  try {
    const existing = await getData(`goals/${req.params.id}/${req.params.goalId}`);
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const updated = { ...existing, ...req.body };
    await setData(`goals/${req.params.id}/${req.params.goalId}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// ==================== TEACHERS ====================
app.get('/api/teachers', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const teachers = usersData ? Object.values(usersData).filter((u: any) => u.role === 'teacher') : [];
    res.json(teachers.map(safeUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

app.get('/api/teachers/:id', async (req, res) => {
  try {
    const user = await getData(`users/${req.params.id}`);
    if (!user || user.role !== 'teacher') return res.status(404).json({ error: 'Teacher not found' });
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

app.get('/api/teachers/:id/classes', async (req, res) => {
  try {
    const teacher = await getData(`users/${req.params.id}`);
    if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ error: 'Teacher not found' });
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && teacher.classes?.includes(u.class)) : [];
    res.json({
      classes: teacher.classes || [],
      subjects: teacher.subjects || [],
      students: students.map(safeUser),
      studentCount: students.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teacher classes' });
  }
});

// ==================== SUBJECTS ====================
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await getData('subjects');
    res.json(subjects ? Object.values(subjects) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const subject = await getData(`subjects/${req.params.id}`);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { role, userId } = req.query;
    const usersData = await getData('users') as any;
    const assignmentsData = await getData('assignments');
    const eventsData = await getData('events');

    const stats: any = {
      totalStudents: usersData ? Object.values(usersData).filter((u: any) => u.role === 'student').length : 0,
      totalTeachers: usersData ? Object.values(usersData).filter((u: any) => u.role === 'teacher').length : 0,
      totalAssignments: assignmentsData ? Object.values(assignmentsData).length : 0,
      upcomingEvents: eventsData ? Object.values(eventsData).filter((e: any) => new Date(e.date) >= new Date()).length : 0,
    };

    if (role === 'student' && userId) {
      const grades = await getData(`grades/${userId}`);
      const attendance = await getData(`attendance/${userId}`);
      const student = await getData(`users/${userId}`);
      stats.grades = grades || [];
      stats.attendance = attendance || [];
      stats.gpa = student?.gpa || 0;
      stats.studentClass = student?.class || '';
      const assignments = assignmentsData ? Object.values(assignmentsData).filter((a: any) => a.class === student?.class) : [];
      stats.pendingAssignments = assignments.filter((a: any) => !a.submissions?.some((s: any) => s.studentId === userId)).length;
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ==================== ASSIGNMENTS ====================
app.get('/api/assignments', async (req, res) => {
  try {
    const assignmentsData = await getData('assignments');
    const { class: className, subjectId, studentId } = req.query;
    let assignments = assignmentsData ? Object.values(assignmentsData) : [];
    if (className) assignments = assignments.filter((a: any) => a.class === className);
    if (subjectId) assignments = assignments.filter((a: any) => a.subjectId === subjectId);
    if (studentId) {
      assignments = assignments.map((a: any) => {
        const submission = a.submissions?.find((s: any) => s.studentId === studentId);
        return {
          ...a,
          studentStatus: submission ? (submission.scoredMarks !== undefined ? 'graded' : 'submitted') : (new Date(a.dueDate) < new Date() ? 'late' : 'pending'),
          scoredMarks: submission?.scoredMarks,
          feedback: submission?.feedback
        };
      });
    }
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

app.get('/api/assignments/:id', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.id}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const newAssignment = { id: `a${Date.now()}`, ...req.body, submissions: [] };
    await setData(`assignments/${newAssignment.id}`, newAssignment);
    res.status(201).json(newAssignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

app.put('/api/assignments/:id', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.id}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const updated = { ...assignment, ...req.body };
    await setData(`assignments/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    await removeData(`assignments/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

app.post('/api/assignments/:id/submit', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.id}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const { studentId, content } = req.body;
    const submissions = assignment.submissions || [];
    const existingIdx = submissions.findIndex((s: any) => s.studentId === studentId);
    if (existingIdx >= 0) {
      submissions[existingIdx] = { ...submissions[existingIdx], content, submittedAt: new Date().toISOString() };
    } else {
      submissions.push({ studentId, content, submittedAt: new Date().toISOString() });
    }
    await setData(`assignments/${req.params.id}/submissions`, submissions);
    res.json({ ...assignment, submissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit assignment' });
  }
});

app.post('/api/assignments/:id/grade', async (req, res) => {
  try {
    const assignment = await getData(`assignments/${req.params.id}`);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    const { studentId, scoredMarks, feedback } = req.body;
    const submissions = assignment.submissions || [];
    const existingIdx = submissions.findIndex((s: any) => s.studentId === studentId);
    if (existingIdx >= 0) {
      submissions[existingIdx] = { ...submissions[existingIdx], scoredMarks, feedback };
    }
    await setData(`assignments/${req.params.id}/submissions`, submissions);
    res.json({ ...assignment, submissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grade assignment' });
  }
});

// ==================== TIMETABLE ====================
app.get('/api/timetable/:class', async (req, res) => {
  try {
    const raw = await getData(`timetable/${req.params.class}`);
    if (!raw) return res.json([]);
    const arr = Array.isArray(raw) ? raw : [];
    const isFlat = arr.length > 0 && ('subject' in arr[0]);
    const entries = isFlat
      ? arr
      : arr.flatMap((dayEntry: any) =>
          (dayEntry.periods || []).map((p: any, i: number) => ({
            id: `${req.params.class}-${dayEntry.day}-${i}`,
            class: req.params.class,
            day: dayEntry.day,
            time: p.time || `${String(8 + i).padStart(2, '0')}:00`,
            subject: p.subject || '',
            teacher: p.teacher || '',
            room: p.room || '',
          }))
        );
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

app.post('/api/timetable', async (req, res) => {
  try {
    const { className, schedule } = req.body;
    await setData(`timetable/${className}`, schedule);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timetable' });
  }
});

// ==================== SCHOOLS ====================
app.get('/api/schools', async (req, res) => {
  try {
    const schools = await getData('schools');
    res.json(schools ? Object.values(schools) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// ==================== ROUTES (Transport) ====================
app.get('/api/routes', async (req, res) => {
  try {
    const [routesData, usersData] = await Promise.all([getData('routes'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const routes = routesData ? Object.values(routesData) as any[] : [];
    // Attach the driver's on-leave status so riders can see "no service today".
    const enriched = routes.map((r: any) => ({
      ...r,
      onLeave: !!(r?.driverId && users[r.driverId]?.onLeave),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

app.get('/api/routes/:id', async (req, res) => {
  try {
    const route = await getData(`routes/${req.params.id}`);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && u.routeId === route.id) : [];
    res.json({ ...route, students: students.map(safeUser) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

app.post('/api/routes', async (req, res) => {
  try {
    const route = { id: `r${Date.now()}`, ...req.body };
    await setData(`routes/${route.id}`, route);
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create route' });
  }
});

app.put('/api/routes/:id', async (req, res) => {
  try {
    const existing = await getData(`routes/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Route not found' });
    const updated = { ...existing, ...req.body };
    await setData(`routes/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update route' });
  }
});

// ==================== EVENTS ====================
app.get('/api/events', async (req, res) => {
  try {
    const events = await getData('events');
    res.json(events ? Object.values(events) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const newEvent = { id: `e${Date.now()}`, ...req.body };
    await setData(`events/${newEvent.id}`, newEvent);
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const existing = await getData(`events/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    const updated = { ...existing, ...req.body };
    await setData(`events/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await removeData(`events/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ==================== CLUBS ====================
app.get('/api/clubs', async (_req, res) => {
  try {
    const data = await getData('clubs') as any;
    const clubs = data ? Object.values(data) as any[] : [];
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

app.post('/api/clubs', async (req, res) => {
  try {
    const club = { id: `c${Date.now()}`, ...req.body };
    await setData(`clubs/${club.id}`, club);
    res.status(201).json(club);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create club' });
  }
});

// ==================== MESSAGES ====================
app.get('/api/messages/:userId', async (req, res) => {
  try {
    const messages = await getData(`messages/${req.params.userId}`);
    res.json(messages ? Object.values(messages) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { from, to, content } = req.body;
    const msg = { id: `msg${Date.now()}`, from, to, content, timestamp: new Date().toISOString(), read: false };
    await setData(`messages/${from}/${msg.id}`, msg);
    await setData(`messages/${to}/${msg.id}`, msg);
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ==================== NOTIFICATIONS ====================
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await getData(`notifications/${req.params.userId}`);
    res.json(notifications ? Object.values(notifications) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;
    const notification = { id: `n${Date.now()}`, title, message, type, timestamp: new Date().toISOString(), read: false };
    await setData(`notifications/${userId}/${notification.id}`, notification);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put('/api/notifications/:userId/:id/read', async (req, res) => {
  try {
    const notification = await getData(`notifications/${req.params.userId}/${req.params.id}`);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    await setData(`notifications/${req.params.userId}/${req.params.id}/read`, true);
    res.json({ ...notification, read: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// ==================== QUESTION BANK ====================
app.get('/api/question-bank', async (req, res) => {
  try {
    const questionsData = await getData('questionBank');
    const { subjectId, type, difficulty } = req.query;
    let questions = questionsData ? Object.values(questionsData) : [];
    if (subjectId) questions = questions.filter((q: any) => q.subjectId === subjectId);
    if (type) questions = questions.filter((q: any) => q.type === type);
    if (difficulty) questions = questions.filter((q: any) => q.difficulty === difficulty);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.post('/api/question-bank', async (req, res) => {
  try {
    const q = { id: `q${Date.now()}`, ...req.body };
    await setData(`questionBank/${q.id}`, q);
    res.status(201).json(q);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// ==================== ATTENDANCE MARKING ====================
app.post('/api/attendance/mark', async (req, res) => {
  try {
    const { class: className, date, entries } = req.body;
    if (!className || !date || !entries) return res.status(400).json({ error: 'Missing required fields' });
    for (const entry of entries) {
      const existing = await getData(`attendance/${entry.studentId}`);
      const records = existing ? Object.values(existing) : [];
      const existingIdx = records.findIndex((r: any) => r.date === date);
      if (existingIdx >= 0) {
        records[existingIdx] = { date, status: entry.status, class: className };
      } else {
        records.push({ date, status: entry.status, class: className });
      }
      await setData(`attendance/${entry.studentId}`, records);
    }
    res.json({ success: true, message: `Attendance saved for ${className} on ${date}`, count: entries.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

app.get('/api/attendance/class/:class', async (req, res) => {
  try {
    const className = req.params.class;
    const date = req.query.date as string;
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && u.class === className) : [];
    const result = [];
    for (const s of students as any[]) {
      const attendance = await getData(`attendance/${(s as any).id}`);
      const records = attendance ? Object.values(attendance) : [];
      const todayRecord = date ? records.find((r: any) => r.date === date) : null;
      result.push({ ...safeUser(s), status: (todayRecord as any)?.status || 'unmarked' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class attendance' });
  }
});

// ==================== NOTES ====================
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await getData('notes');
    const { class: className, subject, teacherId } = req.query;
    let result = notes ? Object.values(notes) : [];
    if (className) result = result.filter((n: any) => n.class === className);
    if (subject) result = result.filter((n: any) => n.subject === subject);
    if (teacherId) result = result.filter((n: any) => n.teacherId === teacherId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    const note = { id: `note${Date.now()}`, createdAt: new Date().toISOString(), downloads: 0, ...req.body };
    await setData(`notes/${note.id}`, note);
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    const existing = await getData(`notes/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`notes/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await removeData(`notes/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ==================== CHAT CHANNELS ====================
app.get('/api/chat/channels', async (req, res) => {
  try {
    const channels = await getData('chatChannels');
    res.json(channels ? Object.values(channels) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.post('/api/chat/channels', async (req, res) => {
  try {
    const channel = { id: `ch${Date.now()}`, createdAt: new Date().toISOString(), ...req.body };
    await setData(`chatChannels/${channel.id}`, channel);
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

app.get('/api/chat/channels/:id/messages', async (req, res) => {
  try {
    const messages = await getData(`chatMessages/${req.params.id}`);
    const limit = parseInt(req.query.limit as string) || 50;
    const result = messages ? Object.values(messages).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-limit) : [];
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/chat/channels/:id/messages', async (req, res) => {
  try {
    const msg = { id: `chatmsg${Date.now()}`, timestamp: new Date().toISOString(), ...req.body };
    await setData(`chatMessages/${req.params.id}/${msg.id}`, msg);
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ==================== GRADES ENTRY ====================
app.post('/api/grades/enter', async (req, res) => {
  try {
    const { studentId, subject, grade, marks } = req.body;
    const existing = await getData(`grades/${studentId}`);
    const records = existing ? Object.values(existing) : [];
    const idx = records.findIndex((r: any) => r.subject === subject);
    if (idx >= 0) {
      records[idx] = { subject, grade, marks };
    } else {
      records.push({ subject, grade, marks });
    }
    await setData(`grades/${studentId}`, records);
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enter grades' });
  }
});

// ==================== CIRCULARS ====================
app.get('/api/circulars', async (req, res) => {
  try {
    const circulars = await getData('circulars');
    const { status, type } = req.query;
    let result = circulars ? Object.values(circulars) : [];
    if (status) result = result.filter((c: any) => c.status === status);
    if (type) result = result.filter((c: any) => c.type === type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch circulars' });
  }
});

app.post('/api/circulars', async (req, res) => {
  try {
    const circular = { id: `cir${Date.now()}`, createdAt: new Date().toISOString(), ...req.body };
    await setData(`circulars/${circular.id}`, circular);
    res.status(201).json(circular);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create circular' });
  }
});

app.put('/api/circulars/:id', async (req, res) => {
  try {
    const existing = await getData(`circulars/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Circular not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`circulars/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update circular' });
  }
});

app.delete('/api/circulars/:id', async (req, res) => {
  try {
    await removeData(`circulars/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete circular' });
  }
});

// ==================== ANNOUNCEMENTS ====================
app.get('/api/announcements', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    let announcements = data ? Object.values(data) as any[] : [];
    const { priority } = req.query;
    if (priority) announcements = announcements.filter((a: any) => a.priority === priority);
    announcements.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const dateA = a.createdAt || a.date || 0;
      const dateB = b.createdAt || b.date || 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/announcements', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    const announcements = data ? Object.values(data) as any[] : [];
    const newAnn = { ...req.body, id: `ann${Date.now()}`, pinned: false, approved: req.body.authorRole === 'admin' || req.body.authorRole === 'manager' };
    announcements.push(newAnn);
    await setData('announcements', Object.fromEntries(announcements.map(a => [a.id, a])));
    res.json({ success: true, announcement: newAnn });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.put('/api/announcements/:id', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Announcement not found' });
    data[req.params.id] = { ...data[req.params.id], ...req.body };
    await setData('announcements', data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Announcement not found' });
    delete data[req.params.id];
    await setData('announcements', data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ==================== EXAMS ====================
app.get('/api/exams', async (req, res) => {
  try {
    const exams = await getData('exams');
    const { class: className, subjectId } = req.query;
    let result = exams ? Object.values(exams) : [];
    if (className) result = result.filter((e: any) => e.class === className);
    if (subjectId) result = result.filter((e: any) => e.subjectId === subjectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

app.post('/api/exams', async (req, res) => {
  try {
    const exam = { id: `ex${Date.now()}`, ...req.body };
    await setData(`exams/${exam.id}`, exam);
    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

app.put('/api/exams/:id', async (req, res) => {
  try {
    const existing = await getData(`exams/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Exam not found' });
    const updated = { ...existing, ...req.body };
    await setData(`exams/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

app.delete('/api/exams/:id', async (req, res) => {
  try {
    await removeData(`exams/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

// ==================== SUPPLY ALERTS ====================
app.get('/api/supply-alerts', async (req, res) => {
  try {
    const alerts = await getData('supplyAlerts');
    const { class: className, priority } = req.query;
    let result = alerts ? Object.values(alerts) : [];
    if (className) result = result.filter((a: any) => a.class === className);
    if (priority) result = result.filter((a: any) => a.priority === priority);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supply alerts' });
  }
});

app.post('/api/supply-alerts', async (req, res) => {
  try {
    const alert = { id: `sa${Date.now()}`, ...req.body };
    await setData(`supplyAlerts/${alert.id}`, alert);
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supply alert' });
  }
});

app.put('/api/supply-alerts/:id', async (req, res) => {
  try {
    const existing = await getData(`supplyAlerts/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Alert not found' });
    const updated = { ...existing, ...req.body };
    await setData(`supplyAlerts/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// ==================== BOOK ALERTS ====================
app.get('/api/book-alerts', async (req, res) => {
  try {
    const alerts = await getData('bookAlerts');
    const { class: className } = req.query;
    let result = alerts ? Object.values(alerts) : [];
    if (className) result = result.filter((a: any) => a.class === className);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch book alerts' });
  }
});

app.post('/api/book-alerts', async (req, res) => {
  try {
    const alert = { id: `ba${Date.now()}`, ...req.body };
    await setData(`bookAlerts/${alert.id}`, alert);
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create book alert' });
  }
});

// ==================== DIGITAL FRIDGE ====================
app.get('/api/digital-fridge/:childId', async (req, res) => {
  try {
    const items = await getData('digitalFridge');
    const result = items ? Object.values(items).filter((i: any) => i.childId === req.params.childId) : [];
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch digital fridge items' });
  }
});

app.post('/api/digital-fridge', async (req, res) => {
  try {
    const item = { id: `df${Date.now()}`, ...req.body };
    await setData(`digitalFridge/${item.id}`, item);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create fridge item' });
  }
});

// ==================== UNIFORM SCHEDULE ====================
app.get('/api/uniform-schedule', async (req, res) => {
  try {
    const schedule = await getData('uniformSchedule');
    res.json(schedule ? Object.values(schedule) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch uniform schedule' });
  }
});

app.post('/api/uniform-schedule', async (req, res) => {
  try {
    const item = { id: `us${Date.now()}`, ...req.body };
    await setData(`uniformSchedule/${item.id}`, item);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create uniform schedule' });
  }
});

app.put('/api/uniform-schedule/:id', async (req, res) => {
  try {
    const existing = await getData(`uniformSchedule/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });
    const updated = { ...existing, ...req.body };
    await setData(`uniformSchedule/${req.params.id}`, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update uniform schedule' });
  }
});

// ==================== AI PROXY ====================
const CEREBRAS_MODELS: Record<string, string> = {
  'gpt-oss-120b': 'openai/gpt-oss-120b',
  'llama3.1-8b': 'llama3.1-8b',
  'qwen-3-235b': 'qwen/qwen3-32b',
  'zai-glm-4.7': 'zai-glm-4.7',
};

const GROQ_MODELS: Record<string, string> = {
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
  'gpt-oss-120b-groq': 'openai/gpt-oss-120b',
  'qwen3-32b': 'qwen/qwen3-32b',
  'compound': 'groq/compound',
  'compound-mini': 'groq/compound-mini',
};

app.post('/api/ai/chat', async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a311b'},body:JSON.stringify({sessionId:'6a311b',runId:'pre-fix',hypothesisId:'H5',location:'index.ts:ai-chat-entry',message:'index ai chat handler entered',data:{model:req.body?.model || 'none',messagesCount:Array.isArray(req.body?.messages) ? req.body.messages.length : -1},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { messages, model = 'gemini', systemPrompt } = req.body;
    const allMessages = [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), ...messages];

    if (CEREBRAS_MODELS[model] && process.env.CEREBRAS_API_KEY) {
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}` },
        body: JSON.stringify({ model: CEREBRAS_MODELS[model], messages: allMessages, temperature: 0.7, max_tokens: 2048 }),
      });
      const data: any = await response.json();
      if (data.choices?.[0]?.message?.content) return res.json({ response: data.choices[0].message.content });
      return res.json({ response: 'No response from Cerebras', error: data });
    }

    if (GROQ_MODELS[model] && process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: GROQ_MODELS[model], messages: allMessages, temperature: 0.7, max_tokens: 2048 }),
      });
      const data: any = await response.json();
      if (data.choices?.[0]?.message?.content) return res.json({ response: data.choices[0].message.content });
      return res.json({ response: 'No response from Groq', error: data });
    }

    if (process.env.GEMINI_API_KEY) {
      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      const data: any = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) return res.json({ response: data.candidates[0].content.parts[0].text });
    }

    const lastMessage = messages[messages.length - 1]?.content || '';
    res.json({ response: generateFallbackResponse(lastMessage, systemPrompt) });
  } catch (error) {
    console.error('AI API error:', error);
    const lastMessage = req.body.messages?.[req.body.messages.length - 1]?.content || '';
    res.json({ response: generateFallbackResponse(lastMessage, req.body.systemPrompt) });
  }
});

app.post('/api/ai/transcribe', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'Groq API key not configured' });
    const { audioBase64, filename = 'audio.webm' } = req.body;
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });
    const data: any = await response.json();
    res.json({ text: data.text || '' });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

app.post('/api/ai/tts', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'Groq API key not configured' });
    const { text, voice = 'Orpheus' } = req.body;
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', input: text, voice }),
    });
    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'audio/wav');
      res.send(Buffer.from(audioBuffer));
    } else {
      const err = await response.json();
      res.status(500).json({ error: err });
    }
  } catch (error) {
    res.status(500).json({ error: 'TTS failed' });
  }
});

app.get('/api/ai/models', (_req, res) => {
  res.json({
    text: [
      { id: 'gemini', name: 'Gemini 2.0 Flash', provider: 'Google', icon: 'gemini' },
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'Cerebras', icon: 'openai' },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', provider: 'Cerebras', icon: 'meta' },
      { id: 'qwen-3-235b', name: 'Qwen 3 235B', provider: 'Cerebras', icon: 'qwen' },
      { id: 'zai-glm-4.7', name: 'ZAI GLM 4.7', provider: 'Cerebras', icon: 'zai' },
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Groq', icon: 'meta' },
      { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'Groq', icon: 'meta' },
      { id: 'compound', name: 'Groq Compound', provider: 'Groq', icon: 'groq' },
    ],
    speech: [
      { id: 'whisper-large-v3', name: 'Whisper V3', provider: 'Groq', type: 'stt' },
      { id: 'whisper-large-v3-turbo', name: 'Whisper V3 Turbo', provider: 'Groq', type: 'stt' },
      { id: 'orpheus-english', name: 'Orpheus English', provider: 'Groq', type: 'tts' },
    ],
  });
});

function generateFallbackResponse(query: string, systemPrompt?: string): string {
  const q = query.toLowerCase();
  if (q.includes('grade') || q.includes('score')) return "Based on my analysis, I'd recommend reviewing the rubric criteria carefully. The essay shows strong understanding of core concepts. Score: 85/100. Strengths: Clear thesis, good supporting evidence. Improvements: Could strengthen the conclusion and add more varied sentence structures.";
  if (q.includes('study') || q.includes('plan')) return "Here's your personalized study plan:\n\n**Monday-Thursday:** Focus on core subjects (2 hrs each)\n**Friday:** Revision and practice tests\n**Weekend:** Light review and rest\n\nTips: Use the Pomodoro technique (25 min focus, 5 min break). Review notes within 24 hours of class for better retention.";
  if (q.includes('attendance')) return "Your attendance this month is at 94%. You've missed 1 day and were late 0 times. Keep up the great attendance! Students with >95% attendance tend to score 15% higher on exams.";
  if (q.includes('assignment') || q.includes('homework')) return "You have 3 pending assignments:\n1. Quadratic Equations (due Jan 20)\n2. Organic Chemistry Notes (due Jan 22)\n3. Data Structures (due Jan 25)\n\nI recommend starting with the earliest due date. Would you like help with any of these?";
  if (q.includes('schedule') || q.includes('timetable') || q.includes('class')) return "Today's schedule:\n- 08:00: Mathematics (Room 101)\n- 08:50: Physics (Lab 1)\n- 09:40: English (Room 201)\n- 10:25: Break\n- 10:45: Chemistry (Lab 2)\n- 11:35: Biology (Lab 3)\n- 12:20: Lunch\n- 13:00: Computer Science (IT Lab)";
  if (q.includes('exam') || q.includes('test')) return "Upcoming exams:\n- Mathematics Mid-term: Feb 10\n- Physics Lab Test: Feb 12\n- English Essay Test: Feb 14\n\nI can generate a study plan for any of these. Just ask!";
  if (q.includes('route') || q.includes('bus')) return "Your bus Route Alpha runs from North Zone with 8 stops. Estimated pickup: 7:15 AM. The bus is currently on schedule. Next stop: Sector 5 (2 min away).";
  return "I'm EduVault AI, your school assistant! I can help with:\n- Grades & performance analysis\n- Study plans & assignments\n- Schedule & timetable\n- Bus routes & tracking\n- AI grading & feedback\n\nWhat would you like help with?";
}

app.post('/api/ai/grade', async (req, res) => {
  try {
    const { essay, rubric, subject } = req.body;
    if (process.env.GEMINI_API_KEY) {
      const prompt = `Grade this ${subject} essay based on the rubric: ${rubric}\n\nEssay:\n${essay}\n\nProvide grade, score, feedback, strengths, and improvements.`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 2048 } }) }
      );
      const data: any = await response.json();
      return res.json({ result: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Grading failed' });
    }
    res.json({ result: `**Grade: A- (85/100)**\n\n**Strengths:** Clear structure, good use of evidence, strong thesis statement.\n**Improvements:** Could elaborate more on counterarguments, conclusion needs strengthening.\n**Feedback:** Solid work overall. Focus on developing your analytical depth.` });
  } catch (error) {
    res.status(500).json({ error: 'Grading service unavailable' });
  }
});

app.post('/api/ai/study-plan', async (req, res) => {
  try {
    const { subject, topics, level } = req.body;
    if (process.env.GEMINI_API_KEY) {
      const prompt = `Create a detailed weekly study plan for ${subject}. Topics: ${topics.join(', ')}. Level: ${level}. Include daily goals, resources, practice, and revision.`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }) }
      );
      const data: any = await response.json();
      return res.json({ plan: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Plan generation failed' });
    }
    res.json({ plan: `**Weekly Study Plan: ${subject}**\n\n**Monday:** Review fundamentals - Read Chapter 1-2, solve 10 practice problems\n**Tuesday:** Deep dive into ${topics[0] || 'core topics'} - Watch video lectures, take notes\n**Wednesday:** Practice problems - Complete worksheet, review mistakes\n**Thursday:** ${topics[1] || 'Advanced topics'} - Group study session, Q&A\n**Friday:** Revision - Flashcard review, mock test\n**Weekend:** Light review and rest` });
  } catch (error) {
    res.status(500).json({ error: 'Study plan service unavailable' });
  }
});

// ==================== BORROWED BOOKS ====================
app.get('/api/books/borrowed', async (_req, res) => {
  try {
    const data = await getData('borrowedBooks') as any;
    res.json(data ? Object.values(data) : []);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch borrowed books' }); }
});
app.get('/api/books/borrowed/:studentId', async (req, res) => {
  try {
    const data = await getData('borrowedBooks') as any;
    const books = data ? Object.values(data) as any[] : [];
    res.json(books.filter(b => b.studentId === req.params.studentId));
  } catch (error) { res.status(500).json({ error: 'Failed to fetch borrowed books' }); }
});
app.post('/api/books/borrow', async (req, res) => {
  try {
    const books = await getData('borrowedBooks') as any;
    const bookList = books ? Object.values(books) as any[] : [];
    const newBook = { ...req.body, id: `bb${Date.now()}`, status: 'borrowed', borrowedDate: new Date().toISOString().split('T')[0] };
    bookList.push(newBook);
    await setData('borrowedBooks', Object.fromEntries(bookList.map(b => [b.id, b])));
    res.json({ success: true, book: newBook });
  } catch (error) { res.status(500).json({ error: 'Failed to borrow book' }); }
});
app.put('/api/books/return/:bookId', async (req, res) => {
  try {
    const books = await getData('borrowedBooks') as any;
    if (!books || !books[req.params.bookId]) return res.status(404).json({ error: 'Book not found' });
    books[req.params.bookId].status = 'returned';
    books[req.params.bookId].returnDate = new Date().toISOString().split('T')[0];
    await setData('borrowedBooks', books);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to return book' }); }
});

// ==================== ACCOLADES ====================
app.get('/api/accolades', async (_req, res) => {
  try {
    const data = await getData('accolades') as any;
    res.json(data ? Object.values(data) : []);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch accolades' }); }
});
app.get('/api/accolades/:studentId', async (req, res) => {
  try {
    const data = await getData('accolades') as any;
    const accolades = data ? Object.values(data) as any[] : [];
    res.json(accolades.filter(a => a.studentId === req.params.studentId));
  } catch (error) { res.status(500).json({ error: 'Failed to fetch accolades' }); }
});
app.post('/api/accolades', async (req, res) => {
  try {
    const data = await getData('accolades') as any;
    const accolades = data ? Object.values(data) as any[] : [];
    const newAccolade = { ...req.body, id: `acc${Date.now()}`, status: 'pending', submittedAt: new Date().toISOString() };
    accolades.push(newAccolade);
    await setData('accolades', Object.fromEntries(accolades.map(a => [a.id, a])));
    res.json({ success: true, accolade: newAccolade });
  } catch (error) { res.status(500).json({ error: 'Failed to submit accolade' }); }
});
app.put('/api/accolades/:id/approve', async (req, res) => {
  try {
    const { approvedBy } = req.body;
    const data = await getData('accolades') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Accolade not found' });
    data[req.params.id].status = 'approved';
    data[req.params.id].approvedBy = approvedBy;
    data[req.params.id].approvedAt = new Date().toISOString();
    await setData('accolades', data);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to approve accolade' }); }
});
app.put('/api/accolades/:id/reject', async (req, res) => {
  try {
    const { rejectedBy, reason } = req.body;
    const data = await getData('accolades') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Accolade not found' });
    data[req.params.id].status = 'rejected';
    data[req.params.id].rejectedBy = rejectedBy;
    data[req.params.id].rejectionReason = reason;
    data[req.params.id].rejectedAt = new Date().toISOString();
    await setData('accolades', data);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reject accolade' }); }
});

// ==================== STUDY PLANS ====================
app.get('/api/study-plans/:studentId', async (req, res) => {
  try {
    const data = await getData('studyPlans') as any;
    const plans = data && data[req.params.studentId] ? data[req.params.studentId] : [];
    res.json(plans);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch study plans' }); }
});
app.post('/api/study-plans', async (req, res) => {
  try {
    const { studentId, plan } = req.body;
    const data = await getData('studyPlans') as any;
    const plans = data || {};
    if (!plans[studentId]) plans[studentId] = [];
    const newPlan = { ...plan, id: `sp${Date.now()}`, createdAt: new Date().toISOString() };
    plans[studentId].push(newPlan);
    await setData('studyPlans', plans);
    res.json({ success: true, plan: newPlan });
  } catch (error) { res.status(500).json({ error: 'Failed to create study plan' }); }
});
app.put('/api/study-plans/:planId/task', async (req, res) => {
  try {
    const { studentId, taskIndex, completed } = req.body;
    const data = await getData('studyPlans') as any;
    if (!data || !data[studentId]) return res.status(404).json({ error: 'Study plan not found' });
    const plan = data[studentId].find((p: any) => p.id === req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    plan.tasks[taskIndex].completed = completed;
    await setData('studyPlans', data);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to update task' }); }
});

// ==================== ANNOUNCEMENTS (pin + approve) ====================
app.put('/api/announcements/:id/pin', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Announcement not found' });
    data[req.params.id].pinned = !data[req.params.id].pinned;
    await setData('announcements', data);
    res.json({ success: true, pinned: data[req.params.id].pinned });
  } catch (error) { res.status(500).json({ error: 'Failed to toggle pin' }); }
});
app.put('/api/announcements/:id/approve', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Announcement not found' });
    data[req.params.id].approved = true;
    data[req.params.id].approvedBy = req.body.approvedBy;
    await setData('announcements', data);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to approve announcement' }); }
});

// ==================== USER PROFILE UPDATE ====================
app.put('/api/users/:id/avatar', async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) as any[] : [];
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.avatarUrl = avatarUrl;
    await setData('users', Object.fromEntries(users.map(u => [u.id, u])));
    res.json({ success: true, avatarUrl });
  } catch (error) { res.status(500).json({ error: 'Failed to update avatar' }); }
});
app.put('/api/users/:id', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) as any[] : [];
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    users[userIndex] = { ...users[userIndex], ...req.body };
    await setData('users', Object.fromEntries(users.map(u => [u.id, u])));
    res.json({ success: true, user: safeUser(users[userIndex]) });
  } catch (error) { res.status(500).json({ error: 'Failed to update user' }); }
});

// ==================== ACHIEVEMENTS (anyone can post) ====================
app.get('/api/achievements', async (_req, res) => {
  try {
    const data = await getData('achievements') as any;
    const achievements = data ? Object.values(data) as any[] : [];
    achievements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(achievements);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch achievements' }); }
});
app.post('/api/achievements', async (req, res) => {
  try {
    const data = await getData('achievements') as any;
    const achievements = data ? Object.values(data) as any[] : [];
    const newAch = { ...req.body, id: `ach${Date.now()}`, timestamp: new Date().toISOString(), likes: [], comments: [] };
    achievements.push(newAch);
    await setData('achievements', Object.fromEntries(achievements.map(a => [a.id, a])));
    res.json({ success: true, achievement: newAch });
  } catch (error) { res.status(500).json({ error: 'Failed to create achievement' }); }
});
app.post('/api/achievements/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const data = await getData('achievements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Achievement not found' });
    const ach = data[req.params.id];
    if (!ach.likes) ach.likes = [];
    const idx = ach.likes.indexOf(userId);
    if (idx === -1) ach.likes.push(userId); else ach.likes.splice(idx, 1);
    await setData(`achievements/${req.params.id}`, ach);
    res.json({ success: true, likes: ach.likes });
  } catch (error) { res.status(500).json({ error: 'Failed to toggle like' }); }
});
app.post('/api/achievements/:id/comment', async (req, res) => {
  try {
    const { authorId, authorName, content } = req.body;
    const data = await getData('achievements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Achievement not found' });
    const ach = data[req.params.id];
    if (!ach.comments) ach.comments = [];
    ach.comments.push({ authorId, authorName, content, timestamp: new Date().toISOString() });
    await setData(`achievements/${req.params.id}`, ach);
    res.json({ success: true, comments: ach.comments });
  } catch (error) { res.status(500).json({ error: 'Failed to add comment' }); }
});

// ==================== LEAVE REQUESTS ====================
app.get('/api/leave-requests', async (_req, res) => {
  try {
    const data = await getData('leaveRequests') as any;
    const requests = data ? Object.values(data) as any[] : [];
    requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    res.json(requests);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch leave requests' }); }
});
app.get('/api/leave-requests/:studentId', async (req, res) => {
  try {
    const data = await getData('leaveRequests') as any;
    const requests = data ? Object.values(data) as any[] : [];
    const studentRequests = requests.filter(r => r.studentId === req.params.studentId);
    res.json(studentRequests);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch leave requests' }); }
});
app.post('/api/leave-requests', async (req, res) => {
  try {
    const data = await getData('leaveRequests') as any;
    const requests = data ? Object.values(data) as any[] : [];
    const newReq = { ...req.body, id: `lr${Date.now()}`, status: 'pending', requestedAt: new Date().toISOString() };
    requests.push(newReq);
    await setData('leaveRequests', Object.fromEntries(requests.map(r => [r.id, r])));
    res.json({ success: true, leaveRequest: newReq });
  } catch (error) { res.status(500).json({ error: 'Failed to create leave request' }); }
});
app.put('/api/leave-requests/:id/approve', async (req, res) => {
  try {
    const { approvedBy, approvedAt } = req.body;
    const data = await getData('leaveRequests') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Leave request not found' });
    data[req.params.id].status = 'approved';
    data[req.params.id].approvedBy = approvedBy;
    data[req.params.id].approvedAt = approvedAt || new Date().toISOString();
    await setData(`leaveRequests/${req.params.id}`, data[req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to approve leave request' }); }
});
app.put('/api/leave-requests/:id/reject', async (req, res) => {
  try {
    const data = await getData('leaveRequests') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Leave request not found' });
    data[req.params.id].status = 'rejected';
    await setData(`leaveRequests/${req.params.id}`, data[req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to reject leave request' }); }
});

// ==================== CLUBS POSTS ====================
app.post('/api/clubs/:clubId/posts', async (req, res) => {
  try {
    const data = await getData('clubs') as any;
    if (!data || !data[req.params.clubId]) return res.status(404).json({ error: 'Club not found' });
    const club = data[req.params.clubId];
    if (!club.posts) club.posts = [];
    club.posts.push({ ...req.body, id: `p${Date.now()}`, timestamp: new Date().toISOString(), likes: [] });
    await setData(`clubs/${req.params.clubId}`, club);
    res.json({ success: true, post: club.posts[club.posts.length - 1] });
  } catch (error) { res.status(500).json({ error: 'Failed to create post' }); }
});
app.post('/api/clubs/:clubId/posts/:postId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const data = await getData('clubs') as any;
    if (!data || !data[req.params.clubId]) return res.status(404).json({ error: 'Club not found' });
    const club = data[req.params.clubId];
    const post = club.posts?.find((p: any) => p.id === req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!post.likes) post.likes = [];
    const idx = post.likes.indexOf(userId);
    if (idx === -1) post.likes.push(userId); else post.likes.splice(idx, 1);
    await setData(`clubs/${req.params.clubId}`, club);
    res.json({ success: true, likes: post.likes });
  } catch (error) { res.status(500).json({ error: 'Failed to toggle like' }); }
});

// ==================== MISSING FRONTEND ENDPOINTS ====================

// Bare GET /api/attendance (with query params)
app.get('/api/attendance', async (req, res) => {
  try {
    const { class: className, date, studentId } = req.query;
    if (studentId) {
      const att = await getData(`attendance/${studentId}`);
      return res.json(att ? Object.values(att) : []);
    }
    if (className && date) {
      const usersData = await getData('users') as any;
      const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && u.class === className) : [];
      const result = [];
      for (const s of students as any[]) {
        const att = await getData(`attendance/${(s as any).id}`);
        const records = att ? Object.values(att) : [];
        const dayRec = date ? records.find((r: any) => r.date === date) : null;
        result.push({ studentId: (s as any).id, name: (s as any).name, status: (dayRec as any)?.status || 'unmarked' });
      }
      return res.json(result);
    }
    const allAttendance = await getData('attendance') as any;
    const flat = allAttendance ? Object.values(allAttendance).flat() : [];
    res.json(flat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// POST /api/announcements/:id/read
app.post('/api/announcements/:id/read', async (req, res) => {
  try {
    const data = await getData('announcements') as any;
    if (!data || !data[req.params.id]) return res.status(404).json({ error: 'Announcement not found' });
    if (!data[req.params.id].readBy) data[req.params.id].readBy = [];
    const userId = req.headers['x-user-id'] as string;
    if (userId && !data[req.params.id].readBy.includes(userId)) {
      data[req.params.id].readBy.push(userId);
      await setData(`announcements/${req.params.id}`, data[req.params.id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// GET /api/accounts
app.get('/api/accounts', async (_req, res) => {
  try {
    const accounts = await getData('chartOfAccounts');
    res.json(accounts ? Object.values(accounts) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// GET /api/books (catalogue)
app.get('/api/books', async (_req, res) => {
  try {
    const books = await getData('libraryCatalogue');
    res.json(books ? Object.values(books) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// GET /api/fees (bare)
app.get('/api/fees', async (req, res) => {
  try {
    const studentId = req.query.studentId as string | undefined;
    const usersData = await getData('users') as any;
    const usersMap: Record<string, any> = usersData || {};
    if (studentId) {
      const fees = await getData(`fees/${studentId}`) as any;
      const records = fees ? Object.values(fees) : [];
      const student = usersMap[studentId] || {};
      const enriched = records.map((r: any, i: number) => ({ ...r, id: `${studentId}_${i}`, studentId, studentName: student.name || 'Unknown', class: student.class || '', type: r.type || 'tuition' }));
      return res.json(enriched);
    }
    const allFees = await getData('fees') as any;
    const result: any[] = [];
    if (allFees) {
      for (const [sid, records] of Object.entries(allFees)) {
        const student = usersMap[sid] || {};
        if (Array.isArray(records)) {
          records.forEach((r: any, i: number) => {
            result.push({ ...r, id: `${sid}_${i}`, studentId: sid, studentName: student.name || 'Unknown', class: student.class || '', type: r.type || 'tuition' });
          });
        }
      }
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fees' });
  }
});

// GET /api/payroll (bare, with month query)
app.get('/api/payroll', async (req, res) => {
  try {
    const { month } = req.query;
    const payroll = await getData('payroll') as any;
    let records = payroll ? Object.values(payroll) : [];
    if (month) records = records.filter((r: any) => r.month === month);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

// GET /api/daily-briefing (bare, no userId param)
app.get('/api/daily-briefing', async (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    if (userId) {
      const briefing = await getData(`dailyBriefing/${userId}`);
      if (briefing) return res.json(briefing);
    }
    res.json({
      date: new Date().toISOString().split('T')[0],
      greeting: 'Good morning!',
      events: [],
      tasks: [],
      weather: 'Sunny',
      quote: 'Education is the most powerful weapon which you can use to change the world.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily briefing' });
  }
});

// ==================== PARENT ENDPOINTS ====================
app.get('/api/parent/dashboard', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const user = await getData(`users/${userId}`);
    if (!user) return res.status(404).json({ error: 'Parent not found' });
    const children = (user.children || []) as string[];
    const childData = [];
    for (const childId of children) {
      const child = await getData(`users/${childId}`);
      if (child) {
        const grades = await getData(`grades/${childId}`);
        const attendance = await getData(`attendance/${childId}`);
        const fees = await getData(`fees/${childId}`);
        childData.push({
          ...safeUser(child),
          grades: grades ? Object.values(grades) : [],
          attendance: attendance ? Object.values(attendance) : [],
          fees: fees ? Object.values(fees) : [],
        });
      }
    }
    res.json({ children: childData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch parent dashboard' });
  }
});

app.get('/api/parent/attendance/:childId', async (req, res) => {
  try {
    const attendance = await getData(`attendance/${req.params.childId}`);
    res.json(attendance ? Object.values(attendance) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch child attendance' });
  }
});

app.get('/api/parent/grades/:childId', async (req, res) => {
  try {
    const grades = await getData(`grades/${req.params.childId}`);
    res.json(grades ? Object.values(grades) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch child grades' });
  }
});

app.get('/api/parent/timetable/:childId', async (req, res) => {
  try {
    const child = await getData(`users/${req.params.childId}`);
    const className = child?.class || '10-A';
    const raw = await getData(`timetable/${className}`);
    const arr = Array.isArray(raw) ? raw : [];
    const isFlat = arr.length > 0 && ('subject' in arr[0]);
    const flattened = isFlat ? arr : arr.flatMap((d: any) =>
      (d.periods || []).map((p: any, i: number) => ({
        id: `${className}-${d.day}-${i}`,
        class: className, day: d.day,
        time: p.time || `${String(8 + i).padStart(2, '0')}:00`,
        subject: p.subject || '', teacher: p.teacher || '', room: p.room || '',
      }))
    );
    res.json(flattened);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch child timetable' });
  }
});

app.get('/api/parent/fees/:childId', async (req, res) => {
  try {
    const fees = await getData(`fees/${req.params.childId}`);
    res.json(fees ? Object.values(fees) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch child fees' });
  }
});

app.get('/api/parent/bus/:childId', async (req, res) => {
  try {
    const child = await getData(`users/${req.params.childId}`);
    if (!child?.routeId) return res.json({ route: null, location: null });
    const route = await getData(`routes/${child.routeId}`);
    res.json({ route: route || null, location: null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch child bus' });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================
app.get('/api/analytics/class/:className', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && u.class === req.params.className) : [];
    const totalStudents = students.length;
    let totalMarks = 0;
    let presentCount = 0;
    let totalAttRecords = 0;
    const subjectPerformance: Record<string, number[]> = {};
    const allGrades: { marks: number; grade: string }[] = [];
    let topPerformer = '';
    let topPerformerAvg = 0;
    for (const s of students as any[]) {
      const grades = await getData(`grades/${(s as any).id}`);
      const gradeList = grades ? Object.values(grades) : [];
      let studentTotal = 0;
      for (const g of gradeList as any[]) {
        if (!subjectPerformance[g.subject]) subjectPerformance[g.subject] = [];
        const marks = g.marks || g.overall || 0;
        subjectPerformance[g.subject].push(marks);
        totalMarks += marks;
        studentTotal += marks;
        allGrades.push({ marks, grade: g.grade || 'N/A' });
      }
      const studentAvg = gradeList.length > 0 ? studentTotal / gradeList.length : 0;
      if (studentAvg > topPerformerAvg) {
        topPerformerAvg = studentAvg;
        topPerformer = (s as any).name || '';
      }
      const att = await getData(`attendance/${(s as any).id}`);
      const attList = att ? Object.values(att) : [];
      totalAttRecords += attList.length;
      presentCount += attList.filter((a: any) => a.status === 'present').length;
    }
    const avgGrade = totalStudents > 0 ? Math.round(totalMarks / (totalStudents * Math.max(1, Object.keys(subjectPerformance).length))) : 0;
    const attendance = totalAttRecords > 0 ? Math.round((presentCount / totalAttRecords) * 100) : 0;
    const subjects = Object.entries(subjectPerformance).map(([name, marks]) => ({
      name, avg: Math.round(marks.reduce((a, b) => a + b, 0) / marks.length)
    }));
    const gradeCounts: Record<string, number> = {};
    allGrades.forEach(g => { gradeCounts[g.grade] = (gradeCounts[g.grade] || 0) + 1; });
    const gradeDistribution = Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count }));
    res.json({ className: req.params.className, totalStudents, avgGrade, attendance, topPerformer, subjects, gradeDistribution });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class analytics' });
  }
});

app.get('/api/analytics/progress', async (req, res) => {
  try {
    const className = req.query.class as string;
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && (!className || u.class === className)) : [];
    const progress = [];
    for (const s of students as any[]) {
      const grades = await getData(`grades/${(s as any).id}`);
      const gradeList = grades ? Object.values(grades) : [];
      const avg = gradeList.length > 0 ? Math.round(gradeList.reduce((a: number, g: any) => a + (g.marks || 0), 0) / gradeList.length) : 0;
      progress.push({ studentId: (s as any).id, name: (s as any).name, average: avg, trend: avg > 80 ? 'up' : avg > 60 ? 'stable' : 'down' });
    }
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

app.get('/api/analytics/performance', async (req, res) => {
  try {
    const { class: className, term } = req.query;
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && (!className || u.class === className)) : [];
    const reports = [];
    for (const s of students as any[]) {
      const grades = await getData(`grades/${(s as any).id}`);
      const gradeList = grades ? Object.values(grades) : [];
      const total = gradeList.reduce((a: number, g: any) => a + (g.marks || 0), 0);
      const count = gradeList.length || 1;
      reports.push({
        studentId: (s as any).id,
        name: (s as any).name,
        average: Math.round(total / count),
        total,
        subjects: gradeList,
        term: term || 'current',
        grade: total / count >= 90 ? 'A' : total / count >= 80 ? 'B' : total / count >= 70 ? 'C' : 'D',
      });
    }
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

app.get('/api/analytics/admin', async (_req, res) => {
  try {
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const students = users.filter((u: any) => u.role === 'student');
    const teachers = users.filter((u: any) => u.role === 'teacher');
    const events = await getData('events');
    const eventList = events ? Object.values(events) : [];
    const routes = await getData('routes');
    const routeList = routes ? Object.values(routes) : [];
    res.json({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalEvents: eventList.length,
      totalRoutes: routeList.length,
      attendanceRate: 87,
      feeCollectionRate: 92,
      studentTeacherRatio: students.length > 0 ? Math.round(students.length / Math.max(1, teachers.length)) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin analytics' });
  }
});

app.get('/api/analytics/manager', async (_req, res) => {
  try {
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const schools = await getData('schools');
    const schoolList = schools ? Object.values(schools) : [];
    res.json({
      totalUsers: users.length,
      totalSchools: schoolList.length,
      activeUsers: users.filter((u: any) => u.status !== 'inactive').length,
      systemHealth: 'healthy',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manager analytics' });
  }
});

app.get('/api/analytics/manager/academics', async (_req, res) => {
  try {
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const students = users.filter((u: any) => u.role === 'student');
    const teachers = users.filter((u: any) => u.role === 'teacher');
    const subjects = await getData('subjects');
    const subjectList = subjects ? Object.values(subjects) : [];
    const assignments = await getData('assignments');
    const assignmentList = assignments ? Object.values(assignments) : [];
    res.json({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalSubjects: subjectList.length,
      totalAssignments: assignmentList.length,
      avgClassSize: teachers.length > 0 ? Math.round(students.length / teachers.length) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manager academics' });
  }
});

app.get('/api/analytics/manager/finance', async (_req, res) => {
  try {
    const feesData = await getData('fees') as any;
    let totalCollected = 0;
    let totalOutstanding = 0;
    if (feesData) {
      for (const studentFees of Object.values(feesData) as any[]) {
        const feeList = Object.values(studentFees) as any[];
        for (const f of feeList) {
          totalCollected += f.paid || 0;
          totalOutstanding += (f.amount || 0) - (f.paid || 0);
        }
      }
    }

    const expensesData = await getData('expenses') as any;
    const expensesArr: any[] = expensesData ? Object.values(expensesData) : [];
    const expenses = expensesArr.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    const payslipsData = await getData('payslips') as any;
    const payslipsArr: any[] = payslipsData ? Object.values(payslipsData) : [];
    const payroll = payslipsArr.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
    for (const e of expensesArr) {
      if (e.date) {
        const m = monthNames[new Date(e.date).getMonth()] || 'Unknown';
        if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, expenses: 0 };
        monthlyMap[m].expenses += e.amount || 0;
      }
    }
    monthlyMap['Jan'] = { revenue: 0, expenses: 0 };
    for (const studentFees of Object.values(feesData || {}) as any[]) {
      for (const f of Object.values(studentFees) as any[]) {
        if (f.paid) monthlyMap['Jan'].revenue += f.paid;
      }
    }
    const monthlyTrend = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

    res.json({
      revenue: totalCollected,
      expenses,
      profit: totalCollected - expenses,
      feeCollection: { collected: totalCollected, pending: totalOutstanding },
      payroll,
      monthlyTrend,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manager finance' });
  }
});

app.get('/api/analytics/manager/transport', async (_req, res) => {
  try {
    const routes = await getData('routes');
    const routeList = routes ? Object.values(routes) : [];
    const totalStudents = routeList.reduce((a: number, r: any) => a + (r.students?.length || 0), 0);
    res.json({ totalRoutes: routeList.length, totalStudents, activeVehicles: routeList.length, avgStudentsPerRoute: routeList.length > 0 ? Math.round(totalStudents / routeList.length) : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manager transport' });
  }
});

app.get('/api/analytics/coordinator', async (_req, res) => {
  try {
    const schools = await getData('schools');
    const schoolList = schools ? Object.values(schools) : [];
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const bySchool: Record<string, any> = {};
    for (const s of schoolList as any[]) {
      bySchool[(s as any).id] = { ...(s as any), studentCount: users.filter((u: any) => u.role === 'student' && u.schoolId === (s as any).id).length, teacherCount: users.filter((u: any) => u.role === 'teacher' && u.schoolId === (s as any).id).length };
    }
    res.json({ schools: Object.values(bySchool), totalSchools: schoolList.length, totalStudents: users.filter((u: any) => u.role === 'student').length, totalTeachers: users.filter((u: any) => u.role === 'teacher').length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coordinator analytics' });
  }
});

// ==================== BUS ASSIGNMENTS ====================
app.get('/api/bus/assignments', async (_req, res) => {
  try {
    const [routesData, usersData] = await Promise.all([getData('routes'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const routes = routesData ? Object.values(routesData) as any[] : [];
    const enriched = routes.map((r: any) => ({
      ...r,
      onLeave: !!(r?.driverId && users[r.driverId]?.onLeave),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bus assignments' });
  }
});

// Toggle a driver's on-leave status. While on leave, all routes driven by this
// driver stop being tracked (GPS broadcasts are ignored) and any current
// location is cleared so riders don't see a stale bus.
app.put('/api/bus/drivers/:driverId/leave', async (req, res) => {
  try {
    const { driverId } = req.params;
    const onLeave = !!req.body?.onLeave;
    const driver = await getData(`users/${driverId}`);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    await setData(`users/${driverId}`, { ...driver, onLeave });

    // Update the in-memory tracking set and notify any subscribers per route.
    const routesData = await getData('routes');
    const routes = routesData ? Object.values(routesData) as any[] : [];
    for (const route of routes) {
      if (route?.driverId !== driverId) continue;
      if (onLeave) {
        busTrackingDisabled.add(route.id);
        busLocations.delete(route.id);
      } else {
        busTrackingDisabled.delete(route.id);
      }
      io.emit(`bus:status:${route.id}`, { onLeave });
    }

    res.json({ success: true, driverId, onLeave });
  } catch (error) {
    console.error('[Bus] Set driver leave error:', error);
    res.status(500).json({ error: 'Failed to update driver leave status' });
  }
});

app.post('/api/bus/assignments', async (req, res) => {
  try {
    const data = await getData('busAssignments') as any;
    const assignments = data ? Object.values(data) : [];
    const newAss = { id: `ba${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
    assignments.push(newAss);
    await setData('busAssignments', Object.fromEntries(assignments.map((a: any) => [a.id, a])));
    res.status(201).json(newAss);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bus assignment' });
  }
});

app.delete('/api/bus/assignments/:id', async (req, res) => {
  try {
    await removeData(`busAssignments/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bus assignment' });
  }
});

// ==================== FRONTEND-COMPATIBLE ROUTE ALIASES ====================
// These match what the frontend api.ts expects, redirecting to the correct data
// without requiring frontend rebuilds.

import { id, listData } from './firebase';

// --- Library Aliases ---
app.get('/api/library/catalogue', async (_req, res) => {
  try { const data = await getData('bookCatalogue'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch catalogue' }); }
});
app.post('/api/library/catalogue', async (req, res) => {
  try { const item = { id: id('bk'), ...req.body, addedAt: new Date().toISOString() }; await setData(`bookCatalogue/${item.id}`, item); res.status(201).json(item); }
  catch (e) { res.status(500).json({ error: 'Failed to add book' }); }
});
app.put('/api/library/catalogue/:id', async (req, res) => {
  try { const existing = await getData(`bookCatalogue/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`bookCatalogue/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update book' }); }
});
app.delete('/api/library/catalogue/:id', async (req, res) => {
  try { await removeData(`bookCatalogue/${req.params.id}`); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: 'Failed to delete book' }); }
});
app.get('/api/library/holds', async (_req, res) => {
  try { const data = await getData('bookHolds'); const all: any[] = []; if (data) { for (const v of Object.values(data) as any) { const holds = Object.values(v) as any[]; all.push(...holds); } } res.json(all.filter((h: any) => h.status === 'active')); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch holds' }); }
});
app.post('/api/library/holds', async (req, res) => {
  try { const { bookId, studentId, studentName } = req.body; const book = await getData(`bookCatalogue/${bookId}`); if (!book) return res.status(404).json({ error: 'Book not found' }); const holds = await getData(`bookHolds/${bookId}`); const holdList = holds ? Object.values(holds) : []; if (holdList.some((h: any) => h.studentId === studentId && h.status === 'active')) return res.status(409).json({ error: 'Already have a hold' }); const hold = { id: id('bh'), bookId, studentId, studentName, bookTitle: book.title, status: 'active', placedAt: new Date().toISOString(), position: holdList.filter((h: any) => h.status === 'active').length + 1 }; await setData(`bookHolds/${bookId}/${hold.id}`, hold); await setData(`studentHolds/${studentId}/${hold.id}`, hold); res.status(201).json(hold); }
  catch (e) { res.status(500).json({ error: 'Failed to place hold' }); }
});
app.get('/api/library/holds/:bookId', async (req, res) => {
  try { const holds = await listData(`bookHolds/${req.params.bookId}`); res.json(holds.filter((h: any) => h.status === 'active').sort((a: any, b: any) => a.position - b.position)); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch holds' }); }
});
app.post('/api/library/holds/:id/fulfill', async (req, res) => {
  try { const allData = await getData('bookHolds') as any; if (!allData) return res.status(404).json({ error: 'Hold not found' }); let found: any = null; let foundBookId = ''; for (const [bookId, holds] of Object.entries(allData) as any) { const hold = holds[req.params.id]; if (hold) { found = hold; foundBookId = bookId; break; } } if (!found) return res.status(404).json({ error: 'Hold not found' }); found.status = 'fulfilled'; found.fulfilledAt = new Date().toISOString(); await setData(`bookHolds/${foundBookId}/${req.params.id}`, found); const studentHold = await getData(`studentHolds/${found.studentId}/${req.params.id}`); if (studentHold) { studentHold.status = 'fulfilled'; await setData(`studentHolds/${found.studentId}/${req.params.id}`, studentHold); } const borrow = { id: id('bb'), bookId: foundBookId, bookTitle: found.bookTitle, studentId: found.studentId, studentName: found.studentName, borrowedDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'borrowed' }; await setData(`borrowedBooks/${borrow.id}`, borrow); res.json({ hold: found, borrow }); }
  catch (e) { res.status(500).json({ error: 'Failed to fulfill hold' }); }
});
app.get('/api/library/fines', async (_req, res) => {
  try { const data = await getData('bookFines'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch fines' }); }
});
app.post('/api/library/fines', async (req, res) => {
  try { const fine = { id: id('bf'), ...req.body, status: 'unpaid', calculatedAt: new Date().toISOString() }; await setData(`bookFines/${fine.id}`, fine); res.status(201).json(fine); }
  catch (e) { res.status(500).json({ error: 'Failed to create fine' }); }
});
app.post('/api/library/fines/:id/pay', async (req, res) => {
  try { const fine = await getData(`bookFines/${req.params.id}`); if (!fine) return res.status(404).json({ error: 'Fine not found' }); fine.status = 'paid'; fine.paidAt = new Date().toISOString(); fine.paidBy = req.body.paidBy; await setData(`bookFines/${req.params.id}`, fine); res.json(fine); }
  catch (e) { res.status(500).json({ error: 'Failed to pay fine' }); }
});
app.get('/api/library/class-sets', async (_req, res) => {
  try { const data = await getData('classSets'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch class sets' }); }
});
app.post('/api/library/class-sets', async (req, res) => {
  try { const set = { id: id('cs'), ...req.body, createdAt: new Date().toISOString() }; await setData(`classSets/${set.id}`, set); res.status(201).json(set); }
  catch (e) { res.status(500).json({ error: 'Failed to create class set' }); }
});
app.get('/api/library/reading-logs/:studentId', async (req, res) => {
  try { const data = await getData('readingLogs'); const logs = data ? Object.values(data) : []; res.json(logs.filter((l: any) => l.studentId === req.params.studentId)); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch logs' }); }
});
app.post('/api/library/reading-logs', async (req, res) => {
  try { const log = { id: id('rl'), ...req.body, loggedAt: new Date().toISOString() }; await setData(`readingLogs/${log.id}`, log); res.status(201).json(log); }
  catch (e) { res.status(500).json({ error: 'Failed to log reading' }); }
});
app.get('/api/library/programmes', async (_req, res) => {
  try { const data = await getData('readingProgrammes'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch programmes' }); }
});
app.post('/api/library/programmes', async (req, res) => {
  try { const prog = { id: id('rp'), ...req.body, createdAt: new Date().toISOString() }; await setData(`readingProgrammes/${prog.id}`, prog); res.status(201).json(prog); }
  catch (e) { res.status(500).json({ error: 'Failed to create programme' }); }
});
app.get('/api/library/reviews/:bookId', async (req, res) => {
  try { const data = await getData('bookReviews'); const reviews = data ? Object.values(data) : []; res.json(reviews.filter((r: any) => r.bookId === req.params.bookId)); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch reviews' }); }
});
app.post('/api/library/reviews', async (req, res) => {
  try { const review = { id: id('br'), ...req.body, createdAt: new Date().toISOString() }; await setData(`bookReviews/${review.id}`, review); res.status(201).json(review); }
  catch (e) { res.status(500).json({ error: 'Failed to submit review' }); }
});
app.get('/api/library/ill', async (_req, res) => {
  try { const data = await getData('interlibraryLoans'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch ILLs' }); }
});
app.post('/api/library/ill', async (req, res) => {
  try { const loan = { id: id('ill'), ...req.body, status: 'requested', createdAt: new Date().toISOString() }; await setData(`interlibraryLoans/${loan.id}`, loan); res.status(201).json(loan); }
  catch (e) { res.status(500).json({ error: 'Failed to create ILL' }); }
});

// --- Comms Aliases ---
app.get('/api/comms/push', async (_req, res) => {
  try { const data = await getData('notifications'); const all: any[] = []; if (data) { for (const v of Object.values(data) as any) { const items = Object.values(v) as any[]; all.push(...items); } } res.json(all.sort((a, b) => new Date(b.sentAt || b.timestamp).getTime() - new Date(a.sentAt || a.timestamp).getTime())); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch notifications' }); }
});
app.post('/api/comms/push', async (req, res) => {
  try { const { userId, title, body, data: extData } = req.body; const n = { id: id('pn'), userId, title, body, data: extData || {}, sentAt: new Date().toISOString(), read: false }; await setData(`notifications/${userId}/${n.id}`, n); res.status(201).json(n); }
  catch (e) { res.status(500).json({ error: 'Failed to send notification' }); }
});
app.get('/api/comms/emergency', async (_req, res) => {
  try { const data = await getData('emergencyAlerts'); res.json(data ? Object.values(data).sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch alerts' }); }
});
app.post('/api/comms/emergency', async (req, res) => {
  try { const alert = { id: id('ea'), ...req.body, status: 'active', sentAt: new Date().toISOString(), acknowledged: [] }; await setData(`emergencyAlerts/${alert.id}`, alert); const usersData = await getData('users') as any; if (usersData) { for (const user of Object.values(usersData) as any[]) { const n = { id: id('en'), title: '🚨 EMERGENCY: ' + (alert.title || 'Alert'), body: alert.message, type: 'emergency', sentAt: new Date().toISOString(), read: false, emergencyAlertId: alert.id }; await setData(`notifications/${user.id}/${n.id}`, n); } } res.status(201).json(alert); }
  catch (e) { res.status(500).json({ error: 'Failed to send alert' }); }
});
app.get('/api/comms/moderation', async (req, res) => {
  try { const data = await getData('moderationReports'); let reports = data ? Object.values(data) : []; const { status } = req.query; if (status) reports = reports.filter((r: any) => r.status === status); res.json(reports.sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch reports' }); }
});
app.put('/api/comms/moderation/:id', async (req, res) => {
  try { const report = await getData(`moderationReports/${req.params.id}`); if (!report) return res.status(404).json({ error: 'Report not found' }); report.status = req.body.action === 'remove' ? 'removed' : 'dismissed'; report.reviewedBy = req.body.moderatedBy; report.reviewedAt = new Date().toISOString(); report.action = req.body.action; await setData(`moderationReports/${req.params.id}`, report); res.json(report); }
  catch (e) { res.status(500).json({ error: 'Failed to review report' }); }
});
app.get('/api/comms/email', async (req, res) => {
  try { const data = await getData('emailLog'); let emails = data ? Object.values(data) : []; const { status } = req.query; if (status) emails = emails.filter((e: any) => e.status === status); res.json(emails.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch email log' }); }
});
app.post('/api/comms/email', async (req, res) => {
  try { const { to, subject, body } = req.body; const email = { id: id('em'), to, subject, body, status: 'sent', sentAt: new Date().toISOString() }; await setData(`emailLog/${email.id}`, email); res.status(201).json(email); }
  catch (e) { res.status(500).json({ error: 'Failed to send email' }); }
});

// --- HR Aliases ---
app.post('/api/hr/staff', async (req, res) => {
  try { const staff = { id: `u${Date.now()}`, ...req.body, createdAt: new Date().toISOString() }; await setData(`users/${staff.id}`, staff); res.status(201).json(staff); }
  catch (e) { res.status(500).json({ error: 'Failed to create staff' }); }
});
app.put('/api/hr/staff/:id', async (req, res) => {
  try { const existing = await getData(`users/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`users/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update staff' }); }
});
app.get('/api/hr/certifications/:staffId', async (req, res) => {
  try { const data = await getData('certifications'); let certs = data ? Object.values(data) : []; certs = certs.filter((c: any) => c.userId === req.params.staffId); res.json(certs); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch certifications' }); }
});
app.post('/api/hr/certifications/:staffId', async (req, res) => {
  try { const cert = { id: id('cert'), ...req.body, userId: req.params.staffId, createdAt: new Date().toISOString() }; await setData(`certifications/${cert.id}`, cert); res.status(201).json(cert); }
  catch (e) { res.status(500).json({ error: 'Failed to add certification' }); }
});
app.get('/api/hr/appraisals/:staffId', async (req, res) => {
  try { const data = await getData('appraisals'); let appraisals = data ? Object.values(data) : []; appraisals = appraisals.filter((a: any) => a.userId === req.params.staffId); res.json(appraisals); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch appraisals' }); }
});
app.post('/api/hr/appraisals/:staffId', async (req, res) => {
  try { const appraisal = { id: id('appr'), ...req.body, userId: req.params.staffId, status: 'pending', createdAt: new Date().toISOString() }; await setData(`appraisals/${appraisal.id}`, appraisal); res.status(201).json(appraisal); }
  catch (e) { res.status(500).json({ error: 'Failed to create appraisal' }); }
});
app.get('/api/hr/recruitment', async (_req, res) => {
  try { const data = await getData('recruitmentJobs'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch jobs' }); }
});
app.post('/api/hr/recruitment', async (req, res) => {
  try { const job = { id: id('job'), ...req.body, status: 'open', createdAt: new Date().toISOString() }; await setData(`recruitmentJobs/${job.id}`, job); res.status(201).json(job); }
  catch (e) { res.status(500).json({ error: 'Failed to create job' }); }
});
app.put('/api/hr/recruitment/:id', async (req, res) => {
  try { const app = await getData(`recruitmentApplications/${req.params.id}`); if (!app) return res.status(404).json({ error: 'Not found' }); app.status = req.body.status; app.updatedAt = new Date().toISOString(); await setData(`recruitmentApplications/${req.params.id}`, app); res.json(app); }
  catch (e) { res.status(500).json({ error: 'Failed to update recruitment' }); }
});
app.get('/api/hr/onboarding', async (_req, res) => {
  try { const data = await getData('onboardingTasks'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch tasks' }); }
});
app.post('/api/hr/onboarding', async (req, res) => {
  try { const task = { id: id('obt'), ...req.body, completed: false, createdAt: new Date().toISOString() }; await setData(`onboardingTasks/${task.id}`, task); res.status(201).json(task); }
  catch (e) { res.status(500).json({ error: 'Failed to create task' }); }
});
app.get('/api/hr/payroll', async (req, res) => {
  try { const data = await getData('payslips'); let slips = data ? Object.values(data) : []; const { month } = req.query; if (month) slips = slips.filter((s: any) => s.period === month || s.month === month); res.json(slips); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch payslips' }); }
});
app.post('/api/hr/payroll', async (req, res) => {
  try { const scale = { id: id('psc'), ...req.body, createdAt: new Date().toISOString() }; await setData(`salaryScales/${scale.id}`, scale); res.status(201).json(scale); }
  catch (e) { res.status(500).json({ error: 'Failed to create salary scale' }); }
});
app.post('/api/hr/payroll/process/:month', async (req, res) => {
  try { const { month } = req.params; const { year, processedBy } = req.body; const staff = await listData('users'); const employees = staff.filter((u: any) => ['teacher', 'admin', 'coordinator', 'manager', 'librarian'].includes(u.role)); const scales = await listData('salaryScales'); const payslips: any[] = []; for (const emp of employees) { const scale = scales.find((s: any) => s.position === emp.position || s.role === emp.role); const baseSalary = scale?.baseSalary || 0; const allowances = scale?.allowances || 0; const deductions = scale?.deductions || 0; const netSalary = baseSalary + allowances - deductions; const payslip = { id: id('ps'), userId: emp.id, name: emp.name, position: emp.position || emp.role, month, year: year || new Date().getFullYear().toString(), baseSalary, allowances, deductions, netSalary, status: 'draft', processedBy: processedBy || 'system', processedAt: new Date().toISOString() }; await setData(`payslips/${payslip.id}`, payslip); payslips.push(payslip); } res.json({ success: true, count: payslips.length, payslips }); }
  catch (e) { res.status(500).json({ error: 'Failed to run payroll' }); }
});
app.post('/api/hr/leave/:id/approve', async (req, res) => {
  try { const leave = await getData(`staffLeaves/${req.params.id}`); if (!leave) return res.status(404).json({ error: 'Leave not found' }); leave.status = 'approved'; leave.approvedBy = req.body.approvedBy; leave.approvedAt = new Date().toISOString(); await setData(`staffLeaves/${req.params.id}`, leave); const balances = await getData(`leaveBalances/${leave.userId}`) || {}; balances[leave.type || 'annual'] = (balances[leave.type || 'annual'] || 0) - (leave.days || 1); await setData(`leaveBalances/${leave.userId}`, balances); res.json(leave); }
  catch (e) { res.status(500).json({ error: 'Failed to approve leave' }); }
});

// --- Finance Aliases ---
app.put('/api/finance/budgets/:id', async (req, res) => {
  try { const existing = await getData(`budgets/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`budgets/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update budget' }); }
});
app.post('/api/finance/expenses/:id/approve', async (req, res) => {
  try { const expense = await getData(`expenses/${req.params.id}`); if (!expense) return res.status(404).json({ error: 'Not found' }); expense.status = 'approved'; expense.approvedBy = req.body.approvedBy; expense.approvedAt = new Date().toISOString(); await setData(`expenses/${req.params.id}`, expense); res.json(expense); }
  catch (e) { res.status(500).json({ error: 'Failed to approve expense' }); }
});
app.put('/api/finance/expenses/:id', async (req, res) => {
  try { const existing = await getData(`expenses/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`expenses/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update expense' }); }
});
app.get('/api/finance/procurement', async (_req, res) => {
  try { const reqs = await listData('procurementRequisitions'); const pos = await listData('purchaseOrders'); res.json({ requisitions: reqs, purchaseOrders: pos }); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch procurement' }); }
});
app.post('/api/finance/procurement', async (req, res) => {
  try { const { type } = req.body; if (type === 'purchase-order') { const po = { id: id('po'), ...req.body, createdAt: new Date().toISOString() }; await setData(`purchaseOrders/${po.id}`, po); return res.status(201).json(po); } const reqData = { id: id('prq'), ...req.body, status: 'pending', createdAt: new Date().toISOString() }; await setData(`procurementRequisitions/${reqData.id}`, reqData); res.status(201).json(reqData); }
  catch (e) { res.status(500).json({ error: 'Failed to create procurement' }); }
});
app.get('/api/finance/recurring', async (_req, res) => {
  try { const data = await getData('recurringInvoices'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch recurring invoices' }); }
});
app.post('/api/finance/recurring', async (req, res) => {
  try { const ri = { id: id('ri'), ...req.body, status: 'active', createdAt: new Date().toISOString() }; await setData(`recurringInvoices/${ri.id}`, ri); res.status(201).json(ri); }
  catch (e) { res.status(500).json({ error: 'Failed to create recurring invoice' }); }
});
app.get('/api/finance/fee-automation', async (_req, res) => {
  try { const data = await getData('feeAutomationRules'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch fee automation' }); }
});
app.post('/api/finance/fee-automation', async (req, res) => {
  try { const rule = { id: id('far'), ...req.body, createdAt: new Date().toISOString() }; await setData(`feeAutomationRules/${rule.id}`, rule); res.status(201).json(rule); }
  catch (e) { res.status(500).json({ error: 'Failed to create fee automation rule' }); }
});
app.post('/api/finance/financial-aid/:id/approve', async (req, res) => {
  try { const aid = await getData(`financialAid/${req.params.id}`); if (!aid) return res.status(404).json({ error: 'Not found' }); aid.status = 'approved'; aid.approvedBy = req.body.approvedBy; aid.approvedAt = new Date().toISOString(); await setData(`financialAid/${req.params.id}`, aid); res.json(aid); }
  catch (e) { res.status(500).json({ error: 'Failed to approve aid' }); }
});
app.delete('/api/finance/invoices/:id', async (req, res) => {
  try { await removeData(`invoices/${req.params.id}`); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: 'Failed to delete invoice' }); }
});
app.post('/api/finance/invoices/:id/pay', async (req, res) => {
  try { const invoice = await getData(`invoices/${req.params.id}`); if (!invoice) return res.status(404).json({ error: 'Invoice not found' }); const { amount, paymentMode, createdBy } = req.body; const payment = { id: id('pay'), paymentNumber: `PAY-${Date.now()}`, invoiceId: req.params.id, clientName: invoice.clientName, amount, paymentMode: paymentMode || 'cash', createdBy, createdAt: new Date().toISOString() }; await setData(`payments/${payment.id}`, payment); const allPayments = await listData('payments'); const invoicePayments = allPayments.filter((p: any) => p.invoiceId === req.params.id); const totalPaid = invoicePayments.reduce((s: number, p: any) => s + p.amount, 0); invoice.paymentStatus = totalPaid >= invoice.total ? 'paid' : 'partial'; invoice.lastPaymentAt = new Date().toISOString(); await setData(`invoices/${req.params.id}`, invoice); res.status(201).json(payment); }
  catch (e) { res.status(500).json({ error: 'Failed to record payment' }); }
});

// --- ERP Aliases ---
app.get('/api/erp/company', async (_req, res) => {
  try { const settings = await getData('companySettings'); res.json(settings || {}); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});
app.put('/api/erp/company', async (req, res) => {
  try { const existing = await getData('companySettings') || {}; const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData('companySettings', updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update settings' }); }
});
app.put('/api/erp/products/:id', async (req, res) => {
  try { const existing = await getData(`products/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`products/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update product' }); }
});

// --- Scheduling Aliases ---
app.get('/api/scheduling/rooms/list', async (_req, res) => {
  try { const data = await getData('rooms'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to list rooms' }); }
});
app.put('/api/scheduling/rooms/:id', async (req, res) => {
  try { const existing = await getData(`roomBookings/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`roomBookings/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update room' }); }
});
app.delete('/api/scheduling/rooms/:id', async (req, res) => {
  try { const existing = await getData(`roomBookings/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); existing.status = 'cancelled'; existing.cancelledAt = new Date().toISOString(); await setData(`roomBookings/${req.params.id}`, existing); res.json(existing); }
  catch (e) { res.status(500).json({ error: 'Failed to cancel booking' }); }
});
app.get('/api/scheduling/coverage', async (_req, res) => {
  try { const data = await getData('coverages'); res.json(data ? Object.values(data).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch coverages' }); }
});
app.post('/api/scheduling/coverage', async (req, res) => {
  try { const coverage = { id: id('cov'), ...req.body, status: 'pending', createdAt: new Date().toISOString() }; await setData(`coverages/${coverage.id}`, coverage); res.status(201).json(coverage); }
  catch (e) { res.status(500).json({ error: 'Failed to create coverage' }); }
});
app.put('/api/scheduling/coverage/:id', async (req, res) => {
  try { const existing = await getData(`coverages/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`coverages/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update coverage' }); }
});
app.delete('/api/scheduling/bell-schedules/:id', async (req, res) => {
  try { await removeData(`bellSchedules/${req.params.id}`); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: 'Failed to delete bell schedule' }); }
});
app.put('/api/scheduling/timetable/:className/:day/:periodIdx', async (req, res) => {
  try { const timetable = await getData(`timetable/${req.params.className}`) as any[]; if (!timetable) return res.status(404).json({ error: 'Timetable not found' }); const dayEntry = timetable.find((d: any) => d.day === req.params.day); if (!dayEntry) return res.status(404).json({ error: 'Day not found' }); const idx = parseInt(req.params.periodIdx); if (idx < 0 || idx >= dayEntry.periods.length) return res.status(404).json({ error: 'Period not found' }); dayEntry.periods[idx] = { ...dayEntry.periods[idx], ...req.body }; await setData(`timetable/${req.params.className}`, timetable); res.json({ success: true, timetable }); }
  catch (e) { res.status(500).json({ error: 'Failed to update entry' }); }
});

// ============ MISSING ENDPOINTS: Lost & Found ============
app.get('/api/lost-found', async (_req, res) => {
  try { const data = await getData('lostFound'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch lost & found items' }); }
});
app.post('/api/lost-found', async (req, res) => {
  try { const item = { id: id('lf'), ...req.body, createdAt: new Date().toISOString() }; await setData(`lostFound/${item.id}`, item); res.status(201).json(item); }
  catch (e) { res.status(500).json({ error: 'Failed to create item' }); }
});
app.put('/api/lost-found/:id/claim', async (req, res) => {
  try { const item = await getData(`lostFound/${req.params.id}`); if (!item) return res.status(404).json({ error: 'Not found' }); item.status = 'claimed'; item.claimedAt = new Date().toISOString(); await setData(`lostFound/${req.params.id}`, item); res.json(item); }
  catch (e) { res.status(500).json({ error: 'Failed to claim item' }); }
});
app.put('/api/lost-found/:id/archive', async (req, res) => {
  try { const item = await getData(`lostFound/${req.params.id}`); if (!item) return res.status(404).json({ error: 'Not found' }); item.status = 'archived'; await setData(`lostFound/${req.params.id}`, item); res.json(item); }
  catch (e) { res.status(500).json({ error: 'Failed to archive item' }); }
});

// ============ MISSING ENDPOINTS: Skip Bus ============
app.get('/api/skip-bus', async (_req, res) => {
  try { const data = await getData('skipBusRequests'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch skip bus requests' }); }
});
app.post('/api/skip-bus', async (req, res) => {
  try { const r = { id: id('sb'), ...req.body, status: 'pending', createdAt: new Date().toISOString() }; await setData(`skipBusRequests/${r.id}`, r); res.status(201).json(r); }
  catch (e) { res.status(500).json({ error: 'Failed to create request' }); }
});
app.put('/api/skip-bus/:id/approve', async (req, res) => {
  try { const r = await getData(`skipBusRequests/${req.params.id}`); if (!r) return res.status(404).json({ error: 'Not found' }); r.status = 'approved'; r.approvedAt = new Date().toISOString(); await setData(`skipBusRequests/${req.params.id}`, r); res.json(r); }
  catch (e) { res.status(500).json({ error: 'Failed to approve' }); }
});
app.put('/api/skip-bus/:id/reject', async (req, res) => {
  try { const r = await getData(`skipBusRequests/${req.params.id}`); if (!r) return res.status(404).json({ error: 'Not found' }); r.status = 'rejected'; r.rejectedAt = new Date().toISOString(); await setData(`skipBusRequests/${req.params.id}`, r); res.json(r); }
  catch (e) { res.status(500).json({ error: 'Failed to reject' }); }
});

// ============ MISSING ENDPOINTS: IT Helpdesk ============
app.get('/api/helpdesk', async (_req, res) => {
  try { const data = await getData('helpdeskTickets'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch tickets' }); }
});
app.post('/api/helpdesk', async (req, res) => {
  try { const t = { id: id('ht'), ...req.body, status: 'open', createdAt: new Date().toISOString() }; await setData(`helpdeskTickets/${t.id}`, t); res.status(201).json(t); }
  catch (e) { res.status(500).json({ error: 'Failed to create ticket' }); }
});
app.put('/api/helpdesk/:id', async (req, res) => {
  try { const existing = await getData(`helpdeskTickets/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() }; await setData(`helpdeskTickets/${req.params.id}`, updated); res.json(updated); }
  catch (e) { res.status(500).json({ error: 'Failed to update ticket' }); }
});

// ============ MISSING ENDPOINTS: Clinic ============
app.get('/api/clinic', async (_req, res) => {
  try { const data = await getData('clinicVisits'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch clinic visits' }); }
});
app.post('/api/clinic', async (req, res) => {
  try { const v = { id: id('cv'), ...req.body, createdAt: new Date().toISOString() }; await setData(`clinicVisits/${v.id}`, v); res.status(201).json(v); }
  catch (e) { res.status(500).json({ error: 'Failed to create visit' }); }
});

// ============ MISSING ENDPOINTS: Anonymous Reports ============
app.get('/api/anonymous-reports', async (_req, res) => {
  try { const data = await getData('anonymousReports'); res.json(data ? Object.values(data) : []); }
  catch (e) { res.status(500).json({ error: 'Failed to fetch reports' }); }
});
app.post('/api/anonymous-reports', async (req, res) => {
  try { const r = { id: id('ar'), ...req.body, status: 'pending', createdAt: new Date().toISOString() }; await setData(`anonymousReports/${r.id}`, r); res.status(201).json(r); }
  catch (e) { res.status(500).json({ error: 'Failed to create report' }); }
});
app.put('/api/anonymous-reports/:id/status', async (req, res) => {
  try { const existing = await getData(`anonymousReports/${req.params.id}`); if (!existing) return res.status(404).json({ error: 'Not found' }); existing.status = req.body.status; existing.updatedAt = new Date().toISOString(); await setData(`anonymousReports/${req.params.id}`, existing); res.json(existing); }
  catch (e) { res.status(500).json({ error: 'Failed to update status' }); }
});

// Start server
server.listen(process.env.PORT || PORT, async () => {
  const actualPort = process.env.PORT || PORT;
  console.log(`EduVault AI Backend running on port ${actualPort}`);
  console.log(`Firebase RTDB URL: ${process.env.FIREBASE_DATABASE_URL || 'https://schoolsync-op-csconnect-default-rtdb.asia-southeast1.firebasedatabase.app'}`);
  console.log(`API endpoints ready at http://localhost:${PORT}/api/`);
  // Auto-seed on restart for fresh database
  try {
    await seedDatabase();
  } catch (e) {
    console.warn('[Startup] Seed skipped or already populated:', (e as Error)?.message || e);
  }
  // Load which routes are currently untracked (driver on leave).
  await refreshTrackingDisabled();
});

export default app;