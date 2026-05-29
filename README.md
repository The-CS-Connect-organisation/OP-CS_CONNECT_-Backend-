
# 🏗️ EduVault AI Backend — Cornerstone School ERP API

> **The backbone of the most over-engineered, AI-powered, multi-tenant School Management System.**  
> 59 route modules. 5 architecture phases. 1 Express server. Zero excuses.

---

## 🚀 Who Is This For?

This is the **REST API** that powers every dashboard, every AI feature, every real-time update in EduVault AI. Built for:

| Consumer | What It Serves |
|----------|---------------|
| 🎒 **Student Frontend** | Assignments, grades, attendance, timetable, fees, bus tracking |
| 👨‍🏫 **Teacher Frontend** | Class management, grading, analytics, lesson plans, exams |
| 🏫 **Admin Frontend** | Full ERP (HR, payroll, invoicing, scheduling, library) |
| 🌐 **Coordinator Frontend** | Multi-school comparison & compliance data |
| 🚌 **Driver Frontend** | Routes, GPS, student boarding, SOS alerts |
| 👪 **Parent Frontend** | Child's grades, attendance, fees, bus location |
| 📚 **Librarian Frontend** | Catalogue, borrow/return, overdue tracking |
| 💼 **Manager Frontend** | SIS, HR, finance, transport, audit logs, security |

---

## 🧠 What Did I Learn Building This?

Building a **production-grade backend API** from scratch taught me more than any tutorial ever could:

- **Express.js at scale** — 59 route modules, all cleanly separated, all talking to the same database without conflicts.
- **TypeScript on the server** — strict mode, interfaces everywhere, `ts-node-dev` for hot reload, `tsc` for production builds.
- **Firebase Realtime Database as a REST API** — raw `fetch()` with PUT/GET/DELETE, no SDK dependency. Direct control over every query. Full auth via database secret.
- **Architecture across 5 phases** — modular routing that scaled from 10 routes to 59+ without a single rewrite. Phase 1 → 2 → 3 → 4 → Bonus.
- **Seed data engineering** — ~500 lines of JSON seed data covering 40+ entity types (users, schools, subjects, assignments, grades, attendance, fees, clubs, messages, notifications, library, events, etc.). Every demo just works.
- **Docker + Cloud deployment** — multi-stage Dockerfile (Node 20 Alpine), Render config, Railway-ready. Production builds that are under 100MB.
- **Authentication system** — OTP-based password reset flow (forgot → OTP → verify → reset), login/signup with role-based responses, token-based session management.
- **Security in practice** — database secrets in environment variables, password stripping on responses, CORS middleware, request size limits.
- **Data normalization** — users stored flat, referenced by ID across all entities. Grades keyed by student ID. Messages nested by recipient. Efficient `Object.values()` queries.
- **Health checks + monitoring** — `/api/health` endpoint returns service name, version, timestamp. Ready for uptime monitoring.
- **PDF generation** — `html-pdf` library for report cards, invoices, and official documents.

---

## ✨ What Makes This Backend Special?

- **59+ route files** — each a focused Express router covering one domain. Zero monolithic controllers.
- **5-phase architecture** — Core (attendance, scheduling, SIS) → Academic (exams, classroom, finance) → Advanced (counselling, health, discipline, activities) → Enterprise (facilities, transport, food service, athletics, alumni) → Platform (everything else).
- **Single-file CRUD utility** — `getData()`, `setData()`, `removeData()`, `pushData()`, `listData()` in `firebase.ts` — every route uses the same 5 functions.
- **Full textbook ERP** — chart of accounts, budgets, invoices, payments, expenses, purchase orders, products, clients, leads, orders.
- **Live demo seed** — one `POST /api/seed` call creates 12 users, 6 subjects, 8 assignments, 4 gradesets, 4 attendance records, 4 fee structures, 2 timetables, 2 bus routes, 4 events, 8 clubs, 30+ messages, 6 notifications, 4 announcements, 5 books, 4 accolades, achievements, leave requests, and more.
- **Docker-native** — multi-stage build for tiny production images, exposed on port 5000, ready for any cloud.
- **No ORM, no bloat** — raw Firebase REST. No Mongoose, no Prisma, no TypeORM. Just `fetch()` and JSON.

---

## 📂 The 59 Route Modules

| Phase | Routes | What They Do |
|-------|--------|-------------|
| **1 — Core** | attendance, scheduling, sis, exams, classroom, finance, hr, library, comms, erp | The fundamentals: attendance tracking, bell schedules, student info, exam management, lesson plans, accounting, staff directory, book catalogue, announcements, procurement |
| **2 — Academic** | auth, users, students, teachers, subjects, dashboard, assignments, timetable, schools, routes, events, clubs, messages, notifications, question-bank, notes, chat, grades, study-plan, calendar | Full academic lifecycle: user management, gradebooks, timetables, messaging, real-time chat, AI study plans |
| **3 — Advanced** | counselling, health, discipline, activities, portfolio, enrolment | Student wellness: counselling sessions, health records, disciplinary tracking, extracurricular activities, e-portfolios, enrolment management |
| **4 — Enterprise** | facilities, transport, food-service, athletics, alumni, platform | Campus operations: facility bookings, transport routes, cafeteria management, sports teams, alumni network, platform settings |
| **Bonus** | supply-alerts, book-alerts, digital-fridge, uniform-schedule, accolades, achievements, analytics, parent, bus, fees, payroll, books, daily-briefing, nexus | Daily operations: supply requests, library alerts, lunch tracking, uniform calendar, recognition system, analytics dashboards, parent portal, payroll processing |

---

## 🛠️ Tech Stack

```
Runtime          → Node.js 20 (Alpine in production)
Language         → TypeScript (strict mode)
Framework        → Express.js 4
Database         → Firebase Realtime Database (REST API via fetch)
Auth             → Custom token-based + OTP password reset
PDF Generation   → html-pdf
Validation       → Manual + TypeScript compile-time safety
Dev Server       → ts-node-dev with hot reload
Build Tool       → TypeScript compiler (tsc)
Container        → Docker (multi-stage, Node 20 Alpine)
Deployment       → Railway / Render
CORS             → Fully open (configured per-environment)
```

---

## 🏗️ Architecture

```
src/
├── index.ts              # Express app entry — 59 route mounts, seed data, auth endpoints
├── firebase.ts           # Firebase RTDB REST utilities (get, set, push, remove, list)
├── routes/
│   ├── attendance.ts     # Attendance tracking & policies
│   ├── scheduling.ts     # Bell schedules & room bookings
│   ├── sis.ts            # Student Information System
│   ├── exams.ts          # Exam management & scheduling
│   ├── classroom.ts      # Lesson plans & exercises
│   ├── finance.ts        # Charts of accounts, budgets, expenses
│   ├── hr.ts             # Staff directory & positions
│   ├── library.ts        # Book catalogue & borrowing
│   ├── comms.ts          # Announcements & circulars
│   ├── erp.ts            # Products, orders, clients, leads, invoicing
│   ├── counselling.ts    # Counselling session management
│   ├── health.ts         # Health records & clinic visits
│   ├── discipline.ts     # Disciplinary records
│   ├── activities.ts     # Extracurricular activities
│   ├── portfolio.ts      # Student e-portfolios
│   ├── enrolment.ts      # Enrolment management
│   ├── facilities.ts     # Facility bookings
│   ├── transport.ts      # Transport routes
│   ├── food-service.ts   # Cafeteria & food management
│   ├── athletics.ts      # Sports teams & events
│   ├── alumni.ts         # Alumni network
│   ├── platform.ts       # Platform settings
│   ├── circulars.ts      # Circular management
│   ├── announcements.ts  # Announcement management
│   ├── auth.ts           # Auth routes (login, signup, forgot/reset password)
│   ├── users.ts          # User CRUD
│   ├── students.ts       # Student-specific queries
│   ├── teachers.ts       # Teacher-specific queries
│   ├── subjects.ts       # Subject management
│   ├── dashboard.ts      # Per-role dashboard aggregation
│   ├── assignments.ts    # Assignment CRUD + submissions + grading
│   ├── timetable.ts      # Timetable management
│   ├── schools.ts        # School/multi-tenant management
│   ├── routes.ts         # Transport routes & stops
│   ├── events.ts         # School events
│   ├── clubs.ts          # Club & society management
│   ├── messages.ts       # Internal messaging system
│   ├── notifications.ts  # Notification system
│   ├── question-bank.ts  # Question bank for exams
│   ├── notes.ts          # Study notes management
│   ├── chat.ts           # Real-time chat endpoints
│   ├── grades.ts         # Gradebook management
│   ├── grades.ts         # Grade management
│   ├── study-plan.ts     # AI study plan data
│   ├── calendar.ts       # Academic calendar
│   ├── nexus.ts          # Social feed & interactions
│   ├── achievements.ts   # Achievement/recognition system
│   ├── accolades.ts      # Accolade submission & approval
│   ├── analytics.ts      # Aggregated analytics data
│   ├── parent.ts         # Parent portal data
│   ├── bus.ts            # Bus tracking & GPS data
│   ├── fees.ts           # Fee management
│   ├── payroll.ts        # Payroll processing
│   ├── books.ts          # Library catalogue
│   ├── daily-briefing.ts # AI-curated daily briefing data
│   ├── supply-alerts.ts  # School supply alerts
│   ├── book-alerts.ts    # Library book alerts
│   ├── digital-fridge.ts # Lunch tracking
│   └── uniform-schedule.ts # Uniform calendar
├── data/
│   └── db.json           # Local reference database (for dev)
├── index.ts              # Express app with all route mounts + seed endpoint
├── firebase.ts           # Firebase REST helpers
```

---

## 🚀 Quick Start

```bash
# Clone & go
git clone <your-repo-url>
cd OP-CS_CONNECT_-Backend-

# Install dependencies
npm install

# Configure .env (see below)
# FIREBASE_DATABASE_URL + FIREBASE_DATABASE_SECRET are required

# Start in dev mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production
npm start
```

---

## 🔐 Environment Variables

| Variable | Required | What It Does |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project identifier |
| `FIREBASE_DATABASE_URL` | ✅ | Firebase Realtime DB endpoint (e.g. `https://your-project.firebasedatabase.app`) |
| `FIREBASE_DATABASE_SECRET` | ✅ | Firebase DB secret for authenticated REST access |
| `CEREBRAS_API_KEY` | ⚡ | AI study plan generation |
| `GEMINI_API_KEY` | ⚡ | AI essay grading & chat |
| `GROQ_API_KEY` | ⚡ | AI fallback provider |
| `PORT` | ❌ | Server port (default: 5000) |
| `NODE_ENV` | ❌ | `development` or `production` |

> ⚡ = Required only if frontend uses AI features. The API works without them.

---

## 📡 API Endpoints

### System
```
GET  /api/health        → { status, service, version, timestamp }
POST /api/seed          → Seeds entire database with demo data
```

### Authentication
```
POST /api/auth/login          → { user, token }
POST /api/auth/signup         → { user, token }
POST /api/auth/forgot-password → { message, otp }
POST /api/auth/verify-otp     → { valid }
POST /api/auth/reset-password → { message }
GET  /api/auth/me             → { user }
```

### Core Entities
```
GET/POST    /api/users          → List / Create users
GET/PUT/DEL /api/users/:id      → Read / Update / Delete user
GET         /api/students       → List students (filter by class)
GET         /api/teachers       → List teachers
GET/POST    /api/subjects       → List / Create subjects
GET/POST    /api/schools        → Multi-tenant school management
```

### Academic
```
GET/POST    /api/assignments    → Assignment CRUD + submissions
GET/POST    /api/grades         → Gradebook
GET/POST    /api/attendance     → Attendance records & policies
GET/POST    /api/timetable      → Timetable management
GET/POST    /api/exams          → Exam management
GET/POST    /api/classroom      → Lesson plans, exercises
GET/POST    /api/question-bank  → Question repository
```

### Finance
```
GET/POST    /api/finance        → Chart of accounts, budgets
GET/POST    /api/fees           → Fee structures & payments
GET/POST    /api/payroll        → Payroll processing
GET/POST    /api/erp            → Products, orders, clients, invoices
```

### Communication
```
GET/POST    /api/messages        → Internal messaging
GET/POST    /api/notifications   → Notification system
GET/POST    /api/comms           → Announcements
GET/POST    /api/chat            → Real-time chat
GET/POST    /api/clubs           → Club management with posts
```

### Student Life
```
GET/POST    /api/events          → School events
GET/POST    /api/achievements    → Recognition system
GET/POST    /api/accolades       → Accolade submission & approval
GET/POST    /api/study-plan      → AI study plans
GET/POST    /api/daily-briefing  → Daily morning briefing data
GET/POST    /api/nexus           → Social feed
GET/POST    /api/portfolio       → Student e-portfolio
```

### Operations
```
GET/POST    /api/transport       → Bus routes & stops
GET/POST    /api/bus             → GPS tracking data
GET/POST    /api/library         → Book catalogue & borrowing
GET/POST    /api/facilities      → Room/facility bookings
GET/POST    /api/food-service    → Cafeteria management
GET/POST    /api/health          → Health records
GET/POST    /api/counselling     → Counselling sessions
GET/POST    /api/discipline      → Disciplinary records
```

---

## 🐳 Docker Deployment

```bash
# Build the image
docker build -t eduvault-backend .

# Run it
docker run -p 5000:5000 --env-file .env eduvault-backend

# Or deploy to Railway directly:
# npx railway up
```

The Dockerfile uses a **multi-stage build**:
1. **Builder stage** — installs all deps + compiles TypeScript
2. **Production stage** — installs only production deps + copies compiled output
3. Final image runs on `node:20-alpine` — **~80MB total**

---

## 📊 Seed Data (POST /api/seed)

One endpoint. **500+ lines of JSON.** Everything you need to demo the entire platform:

- **12 users** across 8 roles (student ×4, teacher ×2, admin, coordinator, driver, parent, librarian, manager)
- **6 subjects** with teachers, classes, colors, icons
- **8 assignments** with submissions, grades, feedback
- **4 students' grades** across 5 subjects each
- **4 attendance records** with dates & statuses
- **4 fee structures** with payment tracking
- **2 full timetables** (10-A and 10-B, 5 days, 5 periods each)
- **2 bus routes** with stops & assigned students
- **4 school events**
- **8 clubs** with members, posts, likes, comments
- **30+ messages** across all users
- **6 notifications** with read/unread states
- **4 announcements** with priorities & approval status
- **5 library books** with borrowing records
- **4 accolades** with approval workflow
- **6 achievements** with likes & comments
- **3 leave requests** with approval statuses
- **And more:** question bank, supply alerts, book alerts, digital fridge, uniform schedule, study plans, goals, attendance policies, bell schedules, room bookings, lesson plans, exercises, chart of accounts, budgets, invoices, payments, expenses, staff directory, staff positions, products, orders, clients, leads, library catalogue

---

## 📈 By the Numbers

- **59** route modules
- **5** architecture phases
- **~500** lines of seed data
- **40+** entity types in the database
- **12** demo users across **8** roles
- **1** database utility file (`firebase.ts`) powering everything
- **3** AI API integrations (Cerebras, Gemini, Groq)
- **0** ORMs, **0** external databases, **0** SaaS dependencies (except Firebase)

---

## 🔒 Security Notes

- Password is **never returned** in any API response (`safeUser()` strips it)
- Firebase DB secret is **never exposed** to clients
- CORS is enabled but should be restricted in production
- Request body limited to 10MB (prevents abuse)
- Auth is token-based with `x-user-id` header verification
- OTP expires after 5 minutes

---

## 💡 Design Philosophy

> "The best backend is the one you never have to think about."

- **5 helper functions** — `getData`, `setData`, `pushData`, `removeData`, `listData`. Every route uses the same 5. Zero learning curve.
- **File-per-domain** — each route file is independent, focused, and testable.
- **Seed-first development** — build the data first, then build the API around it. The seed endpoint is the source of truth.
- **No magic** — raw Express, raw Firebase REST, raw TypeScript. No abstractions hiding what's happening.
- **Cloud-native** — Docker from day one. Railway + Render configs included. `.env` driven.

---

## 📄 License & Attribution

Built with ❤️ by **Navaneeth**  
Backed by Firebase Realtime Database  
Powered by Express.js + TypeScript  
Deployed on Railway / Render

---

> *"I wrote 59 route files so you don't have to write any."*

---

Designed with love by **Navaneeth Nalabothu** and **Rishith Manchala**  
Powered by AI
