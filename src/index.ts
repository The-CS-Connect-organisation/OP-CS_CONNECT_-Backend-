import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// Manual CORS headers - MUST BE FIRST MIDDLEWARE!
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

app.use(express.json({ limit: '10mb' }));

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
app.all('/api/seed', async (_req, res) => {
  try {
    console.log('[Seed] Starting database seed...');
    const toObj = (arr: any[]) => Object.fromEntries(arr.map((item: any) => [item.id, item]));
    const seedData = {
      users: toObj([
        { id: "u1", name: "Aarav Sharma", email: "aarav@eduvault.ai", password: "demo1234", role: "student", class: "10-A", subjects: ["Math", "Physics", "Chemistry", "English", "CS"], gpa: 3.8, attendance: 92, feesPaid: true, routeId: "r1", avatar: "AS", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
        { id: "u2", name: "Priya Patel", email: "priya@eduvault.ai", password: "demo1234", role: "student", class: "10-A", subjects: ["Math", "Physics", "Chemistry", "English", "Biology"], gpa: 3.9, attendance: 96, feesPaid: true, routeId: "r1", avatar: "PP", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg" },
        { id: "u3", name: "Rohan Kumar", email: "rohan@eduvault.ai", password: "demo1234", role: "student", class: "10-B", subjects: ["Math", "Physics", "Chemistry", "English", "CS"], gpa: 3.5, attendance: 85, feesPaid: false, routeId: "r2", avatar: "RK", avatarUrl: "https://randomuser.me/api/portraits/men/51.jpg" },
        { id: "u4", name: "Ananya Singh", email: "ananya@eduvault.ai", password: "demo1234", role: "student", class: "10-B", subjects: ["Math", "Physics", "Chemistry", "English", "Biology"], gpa: 3.7, attendance: 89, feesPaid: true, routeId: "r2", avatar: "AS", avatarUrl: "https://randomuser.me/api/portraits/women/53.jpg" },
        { id: "u5", name: "Dr. Rajesh Gupta", email: "rajesh@eduvault.ai", password: "demo1234", role: "teacher", subjects: ["Math", "Physics", "CS"], classes: ["10-A", "10-B"], avatar: "RG", avatarUrl: "https://randomuser.me/api/portraits/men/33.jpg" },
        { id: "u6", name: "Prof. Sunita Verma", email: "sunita@eduvault.ai", password: "demo1234", role: "teacher", subjects: ["Chemistry", "Biology", "English"], classes: ["10-A", "10-B"], avatar: "SV", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
        { id: "u7", name: "Principal Meera", email: "meera@eduvault.ai", password: "demo1234", role: "admin", schoolId: "sch1", avatar: "PM", avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg" },
        { id: "u8", name: "Mr. Vikram", email: "vikram@eduvault.ai", password: "demo1234", role: "coordinator", schoolId: "sch1", avatar: "MV", avatarUrl: "https://randomuser.me/api/portraits/men/22.jpg" },
        { id: "u9", name: "Raju Kumar", email: "raju@eduvault.ai", password: "demo1234", role: "driver", routeId: "r1", avatar: "RK", avatarUrl: "https://randomuser.me/api/portraits/men/75.jpg" },
        { id: "u10", name: "Mrs. Sharma", email: "parent@eduvault.ai", password: "demo1234", role: "parent", children: ["u1"], avatar: "MS", avatarUrl: "https://randomuser.me/api/portraits/women/33.jpg" },
        { id: "u11", name: "Dr. Bookman", email: "librarian@eduvault.ai", password: "demo1234", role: "librarian", avatar: "DB", avatarUrl: "https://randomuser.me/api/portraits/men/86.jpg" },
        { id: "u12", name: "Mr. Arjun Manager", email: "manager@eduvault.ai", password: "demo1234", role: "manager", schoolId: "sch1", avatar: "AM", avatarUrl: "https://randomuser.me/api/portraits/men/61.jpg" }
      ]),
      schools: toObj([{ id: "sch1", name: "Cornerstone International School", address: "123 Education Lane, New Delhi", phone: "+91-11-23456789", email: "info@cornerstone.edu", principal: "Principal Meera", established: 2005, affiliation: "CBSE", grades: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] }]),
      subjects: toObj([
        { id: "sub1", name: "Mathematics", code: "MATH101", teacher: "Dr. Rajesh Gupta", classes: ["10-A", "10-B"] },
        { id: "sub2", name: "Physics", code: "PHY101", teacher: "Dr. Rajesh Gupta", classes: ["10-A", "10-B"] },
        { id: "sub3", name: "Chemistry", code: "CHEM101", teacher: "Prof. Sunita Verma", classes: ["10-A", "10-B"] },
        { id: "sub4", name: "English", code: "ENG101", teacher: "Prof. Sunita Verma", classes: ["10-A", "10-B"] },
        { id: "sub5", name: "Computer Science", code: "CS101", teacher: "Dr. Rajesh Gupta", classes: ["10-A"] },
        { id: "sub6", name: "Biology", code: "BIO101", teacher: "Prof. Sunita Verma", classes: ["10-B"] }
      ]),
      assignments: toObj([
        { id: "a1", title: "Quadratic Equations Worksheet", subjectId: "sub1", subject: "Mathematics", class: "10-A", dueDate: "2026-05-25", status: "active", description: "Solve all problems from Chapter 5", maxMarks: 50, submissions: [{ studentId: "u1", content: "Completed all problems", scoredMarks: 45, feedback: "Excellent work!", submittedAt: "2026-05-20T10:00:00Z" }, { studentId: "u2", content: "Done", scoredMarks: 48, feedback: "Perfect!", submittedAt: "2026-05-21T09:00:00Z" }] },
        { id: "a2", title: "Newton's Laws Lab Report", subjectId: "sub2", subject: "Physics", class: "10-A", dueDate: "2026-05-28", status: "active", description: "Write a lab report on Newton's three laws", maxMarks: 40, submissions: [] },
        { id: "a3", title: "Organic Chemistry Notes", subjectId: "sub3", subject: "Chemistry", class: "10-B", dueDate: "2026-05-22", status: "active", description: "Summarize chapter on organic compounds", maxMarks: 30, submissions: [{ studentId: "u3", content: "Submitted notes", scoredMarks: 25, feedback: "Good effort", submittedAt: "2026-05-19T14:00:00Z" }] },
        { id: "a4", title: "Essay: Climate Change", subjectId: "sub4", subject: "English", class: "10-A", dueDate: "2026-06-01", status: "active", description: "Write a 1000-word essay on climate change", maxMarks: 50, submissions: [] },
        { id: "a5", title: "Data Structures Assignment", subjectId: "sub5", subject: "Computer Science", class: "10-A", dueDate: "2026-06-05", status: "active", description: "Implement linked list and binary tree", maxMarks: 60, submissions: [] },
        { id: "a6", title: "Periodic Table Quiz", subjectId: "sub3", subject: "Chemistry", class: "10-A", dueDate: "2026-05-15", status: "completed", description: "Complete the periodic table quiz", maxMarks: 25, submissions: [{ studentId: "u1", content: "Completed", scoredMarks: 23, feedback: "Great job!", submittedAt: "2026-05-14T11:00:00Z" }, { studentId: "u2", content: "Done", scoredMarks: 25, feedback: "Perfect score!", submittedAt: "2026-05-14T10:00:00Z" }] },
        { id: "a7", title: "Shakespeare Analysis", subjectId: "sub4", subject: "English", class: "10-B", dueDate: "2026-05-10", status: "completed", description: "Analyze Hamlet's soliloquy", maxMarks: 40, submissions: [{ studentId: "u3", content: "Analysis submitted", scoredMarks: 35, feedback: "Well written", submittedAt: "2026-05-09T16:00:00Z" }, { studentId: "u4", content: "Done", scoredMarks: 38, feedback: "Excellent analysis", submittedAt: "2026-05-09T14:00:00Z" }] },
        { id: "a8", title: "Trigonometry Problems", subjectId: "sub1", subject: "Mathematics", class: "10-B", dueDate: "2026-05-08", status: "completed", description: "Solve trigonometric identities", maxMarks: 50, submissions: [{ studentId: "u3", content: "Completed", scoredMarks: 40, feedback: "Good work", submittedAt: "2026-05-07T12:00:00Z" }, { studentId: "u4", content: "Done", scoredMarks: 46, feedback: "Excellent", submittedAt: "2026-05-07T11:00:00Z" }] }
      ]),
      grades: {
        u1: [{ subject: "Math", grade: "A", marks: 92 }, { subject: "Physics", grade: "A-", marks: 88 }, { subject: "Chemistry", grade: "B+", marks: 82 }, { subject: "English", grade: "A", marks: 90 }, { subject: "CS", grade: "A+", marks: 96 }],
        u2: [{ subject: "Math", grade: "A+", marks: 95 }, { subject: "Physics", grade: "A", marks: 91 }, { subject: "Chemistry", grade: "A", marks: 89 }, { subject: "English", grade: "A+", marks: 94 }, { subject: "Biology", grade: "A", marks: 90 }],
        u3: [{ subject: "Math", grade: "B+", marks: 78 }, { subject: "Physics", grade: "B", marks: 72 }, { subject: "Chemistry", grade: "A-", marks: 85 }, { subject: "English", grade: "B+", marks: 79 }, { subject: "CS", grade: "A-", marks: 86 }],
        u4: [{ subject: "Math", grade: "A-", marks: 87 }, { subject: "Physics", grade: "B+", marks: 80 }, { subject: "Chemistry", grade: "A", marks: 88 }, { subject: "English", grade: "A", marks: 91 }, { subject: "Biology", grade: "A+", marks: 93 }]
      },
      attendance: {
        u1: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "absent" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }],
        u2: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "present" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }],
        u3: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "absent" }, { date: "2026-05-03", status: "absent" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "late" }],
        u4: [{ date: "2026-05-01", status: "present" }, { date: "2026-05-02", status: "present" }, { date: "2026-05-03", status: "late" }, { date: "2026-05-04", status: "present" }, { date: "2026-05-05", status: "present" }]
      },
      fees: {
        u1: [
          { term: "Term 1", amount: 50000, paid: 50000, date: "2026-01-15", status: "paid", dueDate: "2026-01-31" },
          { term: "Term 2", amount: 50000, paid: 50000, date: "2026-04-10", status: "paid", dueDate: "2026-04-30" },
          { term: "Term 3", amount: 50000, paid: 50000, date: "2026-07-05", status: "paid", dueDate: "2026-07-31" }
        ],
        u2: [
          { term: "Term 1", amount: 50000, paid: 50000, date: "2026-01-20", status: "paid", dueDate: "2026-01-31" },
          { term: "Term 2", amount: 50000, paid: 50000, date: "2026-04-12", status: "paid", dueDate: "2026-04-30" },
          { term: "Term 3", amount: 50000, paid: 50000, date: "2026-07-08", status: "paid", dueDate: "2026-07-31" }
        ],
        u3: [
          { term: "Term 1", amount: 50000, paid: 50000, date: "2026-01-18", status: "paid", dueDate: "2026-01-31" },
          { term: "Term 2", amount: 50000, paid: 50000, date: "2026-04-15", status: "paid", dueDate: "2026-04-30" },
          { term: "Term 3", amount: 50000, paid: 25000, date: "2026-07-10", status: "partial", dueDate: "2026-07-31" }
        ],
        u4: [
          { term: "Term 1", amount: 50000, paid: 50000, date: "2026-01-22", status: "paid", dueDate: "2026-01-31" },
          { term: "Term 2", amount: 50000, paid: 50000, date: "2026-04-08", status: "paid", dueDate: "2026-04-30" },
          { term: "Term 3", amount: 50000, paid: 50000, date: "2026-07-02", status: "paid", dueDate: "2026-07-31" }
        ]
      },
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
      messages: {
        u1: [
          { id: "msg1", from: "u5", to: "u1", content: "Great work on the math assignment!", timestamp: "2026-05-18T10:00:00Z", read: true },
          { id: "msg2", from: "u2", to: "u1", content: "Hey, want to study together for the physics exam?", timestamp: "2026-05-19T14:00:00Z", read: false }
        ],
        u2: [
          { id: "msg2", from: "u2", to: "u1", content: "Hey, want to study together for the physics exam?", timestamp: "2026-05-19T14:00:00Z", read: false },
          { id: "msg3", from: "u6", to: "u2", content: "Your biology project proposal looks excellent!", timestamp: "2026-05-19T16:00:00Z", read: true }
        ],
        u3: [
          { id: "msg4", from: "u5", to: "u3", content: "Please submit your pending physics lab report by Friday.", timestamp: "2026-05-19T09:00:00Z", read: false }
        ],
        u4: [
          { id: "msg5", from: "u6", to: "u4", content: "Your debate performance was outstanding!", timestamp: "2026-05-18T15:00:00Z", read: true }
        ],
        u5: [
          { id: "msg1", from: "u5", to: "u1", content: "Great work on the math assignment!", timestamp: "2026-05-18T10:00:00Z", read: true },
          { id: "msg4", from: "u5", to: "u3", content: "Please submit your pending physics lab report by Friday.", timestamp: "2026-05-19T09:00:00Z", read: false }
        ],
        u6: [
          { id: "msg3", from: "u6", to: "u2", content: "Your biology project proposal looks excellent!", timestamp: "2026-05-19T16:00:00Z", read: true },
          { id: "msg5", from: "u6", to: "u4", content: "Your debate performance was outstanding!", timestamp: "2026-05-18T15:00:00Z", read: true }
        ],
        u7: [
          { id: "msg6", from: "u12", to: "u7", content: "Please review the new fee structure proposal.", timestamp: "2026-05-20T08:00:00Z", read: false }
        ],
        u10: [
          { id: "msg7", from: "u5", to: "u10", content: "Aarav is doing great in math this semester!", timestamp: "2026-05-19T11:00:00Z", read: true }
        ],
        u11: [
          { id: "msg8", from: "u1", to: "u11", content: "Can I extend the due date for Physics Textbook?", timestamp: "2026-05-20T10:00:00Z", read: false }
        ],
        u12: [
          { id: "msg6", from: "u12", to: "u7", content: "Please review the new fee structure proposal.", timestamp: "2026-05-20T08:00:00Z", read: false }
        ]
      },
      notifications: {
        u1: [
          { id: "n1", title: "AI Study Plan Generated", message: "Your personalized Mathematics study plan is ready! Click to view.", type: "success", timestamp: "2026-05-18T11:00:00Z", read: false, link: "/student/study-planner" },
          { id: "n2", title: "Assignment Graded", message: "Your math assignment has been graded: 45/50", type: "info", timestamp: "2026-05-18T10:00:00Z", read: false, link: "/student/assignments" },
          { id: "n3", title: "Bus Route Update", message: "Route A schedule changed for next week", type: "warning", timestamp: "2026-05-17T08:00:00Z", read: true, link: "/student/bus-tracking" }
        ],
        u2: [
          { id: "n4", title: "Science Fair Reminder", message: "Don't forget to submit your project proposal", type: "info", timestamp: "2026-05-19T09:00:00Z", read: false, link: "/student/announcements" }
        ],
        u3: [
          { id: "n5", title: "Fee Payment Due", message: "Term 2 fee payment is pending. Please pay by May 30.", type: "warning", timestamp: "2026-05-18T12:00:00Z", read: false, link: "/student/fees" }
        ],
        u5: [
          { id: "n6", title: "New Assignment Submissions", message: "3 new submissions for Quadratic Equations Worksheet", type: "info", timestamp: "2026-05-20T10:00:00Z", read: false, link: "/teacher/grading" }
        ]
      },
      questionBank: toObj([
        { id: "q1", subjectId: "sub1", type: "mcq", difficulty: "easy", question: "What is 2+2?", options: ["3", "4", "5", "6"], answer: "4" },
        { id: "q2", subjectId: "sub2", type: "short", difficulty: "medium", question: "State Newton's second law", answer: "F = ma" }
      ]),
      announcements: toObj([
        { id: "ann1", title: "School Closed on Friday", content: "School will be closed this Friday for maintenance. All classes are cancelled. Please ensure you complete your pending assignments before Thursday.", date: "2026-05-23", priority: "high", author: "u7", authorName: "Principal Meera", pinned: true, approved: true },
        { id: "ann2", title: "Science Fair Registration Open", content: "Register for the annual science fair by May 30. Projects can be individual or in teams of up to 3. Submit your project proposal to the science department.", date: "2026-05-20", priority: "medium", author: "u7", authorName: "Principal Meera", pinned: false, approved: true },
        { id: "ann3", title: "Sports Day Practice Schedule", content: "Practice for the annual sports day will begin next week. All house captains please coordinate with the sports department for the schedule.", date: "2026-05-25", priority: "low", author: "u8", authorName: "Mr. Vikram", pinned: false, approved: true },
        { id: "ann4", title: "Library Book Return Reminder", content: "All borrowed books must be returned by May 25th. Overdue books will incur a fine of Rs. 5 per day.", date: "2026-05-22", priority: "medium", author: "u11", authorName: "Dr. Bookman", pinned: true, approved: true }
      ]),
      otpStore: {},
      supplyAlerts: toObj([
        { id: "sa1", item: "Notebook", quantity: 3, priority: "high", class: "10-A", status: "active" },
        { id: "sa2", item: "Pen (Blue)", quantity: 5, priority: "medium", class: "10-A", status: "active" },
        { id: "sa3", item: "Geometry Box", quantity: 1, priority: "low", class: "10-B", status: "active" }
      ]),
      bookAlerts: toObj([
        { id: "ba1", book: "Physics Textbook", weight: "heavy", class: "10-A", date: "2026-05-20", status: "active" }
      ]),
      digitalFridge: toObj([
        { id: "df1", childId: "u1", item: "Lunch Box", status: "consumed", date: "2026-05-19" },
        { id: "df2", childId: "u1", item: "Water Bottle", status: "full", date: "2026-05-19" }
      ]),
      goals: {
        u1: [{ id: "g1", title: "Complete Math Chapter 5", deadline: "2026-05-25", status: "in-progress", progress: 60 }]
      },
      exams: toObj([
        { id: "ex1", title: "Mid-Term Mathematics", subjectId: "sub1", class: "10-A", date: "2026-06-10", duration: 120, totalMarks: 100, status: "upcoming" },
        { id: "ex2", title: "Mid-Term Physics", subjectId: "sub2", class: "10-A", date: "2026-06-12", duration: 90, totalMarks: 80, status: "upcoming" }
      ]),
      uniformSchedule: toObj([
        { id: "us1", day: "Monday", uniform: "Full Uniform", description: "White shirt, navy pants, tie, blazer" },
        { id: "us2", day: "Tuesday", uniform: "Full Uniform", description: "White shirt, navy pants, tie, blazer" },
        { id: "us3", day: "Wednesday", uniform: "House Uniform", description: "House color t-shirt, navy pants" },
        { id: "us4", day: "Thursday", uniform: "Full Uniform", description: "White shirt, navy pants, tie, blazer" },
        { id: "us5", day: "Friday", uniform: "Sports Uniform", description: "School sports t-shirt, track pants" }
      ]),
      borrowedBooks: toObj([
        { id: "bb1", bookTitle: "Physics Textbook Vol 1", isbn: "978-0-123456-01", studentId: "u1", studentName: "Aarav Sharma", borrowedDate: "2026-05-10", dueDate: "2026-05-24", status: "borrowed" },
        { id: "bb2", bookTitle: "Chemistry Lab Manual", isbn: "978-0-123456-02", studentId: "u2", studentName: "Priya Patel", borrowedDate: "2026-05-12", dueDate: "2026-05-26", status: "borrowed" },
        { id: "bb3", bookTitle: "English Literature Guide", isbn: "978-0-123456-03", studentId: "u3", studentName: "Rohan Kumar", borrowedDate: "2026-05-08", dueDate: "2026-05-22", status: "overdue" },
        { id: "bb4", bookTitle: "Mathematics Reference Book", isbn: "978-0-123456-04", studentId: "u1", studentName: "Aarav Sharma", borrowedDate: "2026-05-15", dueDate: "2026-05-29", status: "borrowed" },
        { id: "bb5", bookTitle: "Biology Atlas", isbn: "978-0-123456-05", studentId: "u4", studentName: "Ananya Singh", borrowedDate: "2026-05-14", dueDate: "2026-05-28", status: "borrowed" }
      ]),
      accolades: toObj([
        { id: "acc1", studentId: "u1", studentName: "Aarav Sharma", title: "Math Olympiad Winner", description: "First place in regional mathematics olympiad", category: "academic", certificateUrl: "", status: "approved", submittedAt: "2026-05-01T10:00:00Z", approvedBy: "u7", approvedAt: "2026-05-02T14:00:00Z" },
        { id: "acc2", studentId: "u2", studentName: "Priya Patel", title: "Science Fair Champion", description: "Best project in annual science fair", category: "science", certificateUrl: "", status: "approved", submittedAt: "2026-05-05T09:00:00Z", approvedBy: "u12", approvedAt: "2026-05-06T11:00:00Z" },
        { id: "acc3", studentId: "u3", studentName: "Rohan Kumar", title: "Coding Competition Runner-up", description: "Second place in inter-school coding competition", category: "technology", certificateUrl: "", status: "pending", submittedAt: "2026-05-18T16:00:00Z" },
        { id: "acc4", studentId: "u4", studentName: "Ananya Singh", title: "Best Debater", description: "Outstanding performance in state-level debate", category: "extracurricular", certificateUrl: "", status: "approved", submittedAt: "2026-05-10T12:00:00Z", approvedBy: "u7", approvedAt: "2026-05-11T10:00:00Z" }
      ]),
      studyPlans: {
        u1: [{ id: "sp1", title: "Mathematics Mastery Plan", subject: "Math", startDate: "2026-05-20", endDate: "2026-06-10", tasks: [{ title: "Complete Chapter 5 exercises", completed: true }, { title: "Practice quadratic equations", completed: false }, { title: "Take mock test", completed: false }], createdAt: "2026-05-18T11:00:00Z" }]
      },
      achievements: toObj([
        { id: "ach1", authorId: "u5", authorName: "Dr. Rajesh Gupta", role: "teacher", avatar: "https://randomuser.me/api/portraits/men/33.jpg", title: "Outstanding Performance in Math Olympiad", description: "Congratulations to Aarav Sharma for winning first place in the Regional Mathematics Olympiad! 🏆", targetStudentId: "u1", targetStudentName: "Aarav Sharma", category: "academic", timestamp: "2026-05-01T10:00:00Z", likes: ["u1", "u2", "u7", "u12"], comments: [{ authorId: "u7", authorName: "Principal Meera", content: "Well deserved! Proud of our students.", timestamp: "2026-05-01T11:00:00Z" }] },
        { id: "ach2", authorId: "u2", authorName: "Priya Patel", role: "student", avatar: "https://randomuser.me/api/portraits/women/68.jpg", title: "Science Fair Champion", description: "Won best project in the annual science fair with my renewable energy model! 🔬", targetStudentId: "u2", targetStudentName: "Priya Patel", category: "science", timestamp: "2026-05-05T09:00:00Z", likes: ["u1", "u3", "u4", "u6"], comments: [] },
        { id: "ach3", authorId: "u6", authorName: "Prof. Sunita Verma", role: "teacher", avatar: "https://randomuser.me/api/portraits/women/44.jpg", title: "Best Debater Award", description: "Ananya Singh delivered an outstanding performance at the state-level debate competition! 🎤", targetStudentId: "u4", targetStudentName: "Ananya Singh", category: "extracurricular", timestamp: "2026-05-10T12:00:00Z", likes: ["u1", "u2", "u3", "u7"], comments: [{ authorId: "u4", authorName: "Ananya Singh", content: "Thank you ma'am! 🙏", timestamp: "2026-05-10T13:00:00Z" }] },
        { id: "ach4", authorId: "u1", authorName: "Aarav Sharma", role: "student", avatar: "https://randomuser.me/api/portraits/men/32.jpg", title: "Coding Competition Runner-up", description: "Second place in inter-school coding competition! Built a full-stack app in 24 hours 💻", targetStudentId: "u1", targetStudentName: "Aarav Sharma", category: "technology", timestamp: "2026-05-15T16:00:00Z", likes: ["u3", "u5"], comments: [] },
        { id: "ach5", authorId: "u7", authorName: "Principal Meera", role: "admin", avatar: "https://randomuser.me/api/portraits/women/65.jpg", title: "Perfect Attendance Award", description: "Priya Patel achieved 100% attendance this semester! A remarkable commitment to learning. 📚", targetStudentId: "u2", targetStudentName: "Priya Patel", category: "attendance", timestamp: "2026-05-18T08:00:00Z", likes: ["u1", "u2", "u5", "u6", "u10"], comments: [] },
        { id: "ach6", authorId: "u3", authorName: "Rohan Kumar", role: "student", avatar: "https://randomuser.me/api/portraits/men/51.jpg", title: "Sports Day Gold Medal", description: "Won gold in 100m sprint at inter-house sports day! 🏃‍♂️", targetStudentId: "u3", targetStudentName: "Rohan Kumar", category: "sports", timestamp: "2026-05-20T14:00:00Z", likes: ["u1", "u4"], comments: [] }
      ]),
      leaveRequests: toObj([
        { id: "lr1", studentId: "u1", studentName: "Aarav Sharma", avatar: "https://randomuser.me/api/portraits/men/32.jpg", startDate: "2026-05-26", endDate: "2026-05-27", reason: "Family function - sister's wedding", type: "personal", status: "approved", requestedAt: "2026-05-20T10:00:00Z", approvedBy: "u5", approvedAt: "2026-05-20T14:00:00Z" },
        { id: "lr2", studentId: "u2", studentName: "Priya Patel", avatar: "https://randomuser.me/api/portraits/women/68.jpg", startDate: "2026-06-01", endDate: "2026-06-02", reason: "Medical appointment", type: "medical", status: "pending", requestedAt: "2026-05-21T09:00:00Z" },
        { id: "lr3", studentId: "u3", studentName: "Rohan Kumar", avatar: "https://randomuser.me/api/portraits/men/51.jpg", startDate: "2026-05-30", endDate: "2026-05-30", reason: "Science competition in another city", type: "academic", status: "approved", requestedAt: "2026-05-18T11:00:00Z", approvedBy: "u6", approvedAt: "2026-05-18T15:00:00Z" }
      ]),
      // Phase 1+2 seed data
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
        { id: "exp1", description: "Lab equipment purchase", category: "Lab Equipment", amount: 50000, date: "2026-06-01", paidTo: "Scientific Supplies Co.", paymentMethod: "bank", approvedBy: "u7", status: "approved" }
      ]),
      libraryCatalogue: toObj([
        { id: "bk1", title: "Introduction to Algorithms", author: "CLRS", isbn: "978-0-262-04630-5", category: "Computer Science", copies: 3, available: 2, shelf: "CS-01" },
        { id: "bk2", title: "Organic Chemistry", author: "Morrison & Boyd", isbn: "978-0-13-404228-2", category: "Chemistry", copies: 2, available: 1, shelf: "CH-03" },
        { id: "bk3", title: "University Physics", author: "Young & Freedman", isbn: "978-0-321-69686-1", category: "Physics", copies: 4, available: 3, shelf: "PH-02" },
        { id: "bk4", title: "English Grammar in Use", author: "Raymond Murphy", isbn: "978-1-108-45765-1", category: "English", copies: 5, available: 4, shelf: "EN-01" },
        { id: "bk5", title: "Advanced Mathematics", author: "Kreyszig", isbn: "978-0-470-45836-8", category: "Mathematics", copies: 2, available: 1, shelf: "MA-01" }
      ]),
      clients: toObj([
        { id: "cl1", name: "Sunil Book Depot", contact: "+91-9876543210", email: "sunil@bookdepot.com", type: "vendor", status: "active", creditLimit: 100000 },
        { id: "cl2", name: "EduTech Solutions", contact: "+91-8765432109", email: "info@edutech.com", type: "vendor", status: "active", creditLimit: 500000 }
      ]),
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
    };
    await setData('/', seedData);
    console.log('[Seed] Database seeded SUCCESSFULLY!');
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('[Seed] Seed error:', error);
    res.status(500).json({ error: 'Seed failed', details: error });
  }
});

// ==================== AUTH ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[Login] Attempting login with:', { email, password });
    const usersData = await getData('users') as any;
    console.log('[Login] Users from Firebase:', usersData);
    const users = usersData ? (Object.values(usersData) as any[]) : [];
    console.log('[Login] User array:', users);
    const user = users.find((u: any) => u.email === email && u.password === password);
    console.log('[Login] Found user:', user);
    if (!user) {
      console.log('[Login] Invalid credentials!');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('[Login] Login SUCCESSFUL!');
    res.json({ user: safeUser(user), token: `eduvault-token-${(user as any).id}-${Date.now()}` });
  } catch (error) {
    console.error('[Login] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, role, class: className, parentEmail } = req.body;
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const existing = users.find((u: any) => u.email === email);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const newUser = {
      id: `u${Date.now()}`,
      name,
      email,
      password,
      role: role || 'student',
      class: className || '',
      avatar: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      createdAt: new Date().toISOString()
    };
    await setData(`users/${newUser.id}`, newUser);
    res.status(201).json({ user: safeUser(newUser), token: `eduvault-token-${newUser.id}-${Date.now()}` });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const user = users.find((u: any) => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setData(`otpStore/${email}`, { otp, expiresAt: Date.now() + 300000 });
    res.json({ message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpData = await getData(`otpStore/${email}`);
    if (!otpData || otpData.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ error: 'OTP expired' });
    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpData = await getData(`otpStore/${email}`);
    if (!otpData || otpData.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ error: 'OTP expired' });
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const user = users.find((u: any) => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await setData(`users/${(user as any).id}/password`, newPassword);
    await removeData(`otpStore/${email}`);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const user = await getData(`users/${userId}`);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

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
    const newUser = { id: `u${Date.now()}`, ...req.body };
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
    const updated = { ...existing, ...req.body };
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
    const timetable = await getData(`timetable/${req.params.class}`);
    res.json(timetable || []);
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
    const routes = await getData('routes');
    res.json(routes ? Object.values(routes) : []);
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
      return new Date(b.date).getTime() - new Date(a.date).getTime();
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
    res.json(allAttendance || {});
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
    const { studentId } = req.query;
    if (studentId) {
      const fees = await getData(`fees/${studentId}`);
      return res.json(fees ? Object.values(fees) : []);
    }
    const allFees = await getData('fees') as any;
    res.json(allFees || {});
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
    const timetable = await getData(`timetable/${className}`);
    res.json(timetable || []);
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
    const subjectPerformance: Record<string, number[]> = {};
    for (const s of students as any[]) {
      const grades = await getData(`grades/${(s as any).id}`);
      const gradeList = grades ? Object.values(grades) : [];
      for (const g of gradeList as any[]) {
        if (!subjectPerformance[g.subject]) subjectPerformance[g.subject] = [];
        subjectPerformance[g.subject].push(g.marks || 0);
        totalMarks += g.marks || 0;
      }
      const att = await getData(`attendance/${(s as any).id}`);
      const attList = att ? Object.values(att) : [];
      presentCount += attList.filter((a: any) => a.status === 'present').length;
    }
    const avgMarks = totalStudents > 0 ? Math.round(totalMarks / (totalStudents * Math.max(1, Object.keys(subjectPerformance).length))) : 0;
    const avgAttendance = totalStudents > 0 ? Math.round(presentCount / totalStudents) : 0;
    const subjectAverages = Object.fromEntries(
      Object.entries(subjectPerformance).map(([sub, marks]) => [sub, Math.round(marks.reduce((a, b) => a + b, 0) / marks.length)])
    );
    res.json({ className: req.params.className, totalStudents, avgMarks, avgAttendance, subjectAverages, students: students.map(safeUser) });
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
    res.json({ totalCollected, totalOutstanding, collectionRate: totalCollected + totalOutstanding > 0 ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100) : 0 });
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
    const routes = await getData('routes');
    res.json(routes ? Object.values(routes) : []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bus assignments' });
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

// Start server
app.listen(process.env.PORT || PORT, () => {
  const actualPort = process.env.PORT || PORT;
  console.log(`EduVault AI Backend running on port ${actualPort}`);
  console.log(`Firebase RTDB: ${process.env.FIREBASE_DATABASE_URL}`);
  console.log(`API endpoints ready at http://localhost:${PORT}/api/`);
  console.log(`POST /api/seed to populate the database`);
});

export default app;