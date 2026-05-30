
# EduVault AI Backend — School ERP API

A heartfelt attempt at building a school management backend. We're two students who wanted to create something useful for schools, and this API is what we came up with. It's not perfect, but we learned a lot along the way and we hope it can be helpful to others too.

---

## Who Is This For?

This REST API is the engine behind the EduVault AI platform. It serves data to:

- **Students** — assignments, grades, attendance, timetable, fees, bus tracking
- **Teachers** — class management, grading, analytics, lesson plans, exams
- **Admins** — HR, payroll, invoicing, scheduling, library management
- **Coordinators** — multi-school comparison and compliance data
- **Drivers** — routes, GPS, student boarding, SOS alerts
- **Parents** — child's grades, attendance, fees, bus location
- **Librarians** — catalogue, borrow/return, overdue tracking
- **Managers** — SIS, HR, finance, transport, audit logs, security

---

## What We Learned Building This

This project taught us more than any classroom ever could:

- **Express.js at scale** — we somehow ended up with 59 route modules, all talking to the same database. It worked out, and we're grateful for that.
- **TypeScript on the server** — strict mode kept us honest. `ts-node-dev` for development, `tsc` for production builds.
- **Firebase Realtime Database** — we used raw `fetch()` calls instead of an SDK. It gave us full control and taught us a lot about REST.
- **Architecture that grew with us** — we started small and kept adding. The codebase grew from 10 routes to 59 without needing a rewrite. We're proud of that.
- **Seed data** — we wrote about 500 lines of JSON to cover 40+ entity types. Every demo works out of the box.
- **Docker deployment** — multi-stage builds with Node 20 Alpine. Production images under 100MB.
- **Authentication** — login, signup, OTP-based password reset. Token-based sessions. It's basic but it works.
- **Security basics** — passwords stripped from responses, secrets in environment variables, CORS middleware.
- **PDF generation** — report cards, invoices, and official documents using `html-pdf`.

---

## What Makes This Backend Special (Humbly Speaking)

- **59 route files** — each focused on one domain. We tried to keep things organized.
- **5-phase architecture** — we grouped routes into Core, Academic, Advanced, Enterprise, and Bonus phases based on when we built them.
- **5 utility functions** — `getData()`, `setData()`, `removeData()`, `pushData()`, `listData()` in `firebase.ts`. Every route uses the same 5 functions.
- **Full ERP features** — chart of accounts, budgets, invoices, payments, expenses, purchase orders, products, clients, leads, orders.
- **One-call seed** — `POST /api/seed` creates 12 users, 6 subjects, 8 assignments, and much more.
- **Docker-ready** — multi-stage build, port 5000, works on Render.
- **No ORM** — just raw Firebase REST with `fetch()` and JSON. We kept it simple.

---

## The 59 Route Modules

| Phase | Routes | What They Do |
|-------|--------|-------------|
| **1 — Core** | attendance, scheduling, sis, exams, classroom, finance, hr, library, comms, erp | Attendance, schedules, student info, exams, lessons, accounting, staff, books, announcements, procurement |
| **2 — Academic** | auth, users, students, teachers, subjects, dashboard, assignments, timetable, schools, routes, events, clubs, messages, notifications, question-bank, notes, chat, grades, study-plan, calendar | User management, gradebooks, timetables, messaging, chat, AI study plans |
| **3 — Advanced** | counselling, health, discipline, activities, portfolio, enrolment | Counselling, health records, discipline, extracurriculars, portfolios, enrolment |
| **4 — Enterprise** | facilities, transport, food-service, athletics, alumni, platform | Facility bookings, transport, cafeteria, sports, alumni network, platform settings |
| **Bonus** | supply-alerts, book-alerts, digital-fridge, uniform-schedule, accolades, achievements, analytics, parent, bus, fees, payroll, books, daily-briefing, nexus | Daily operations, recognition, analytics, parent portal, payroll |

---

## Tech Stack

```
Runtime          → Node.js 20 (Alpine in production)
Language         → TypeScript (strict mode)
Framework        → Express.js 4
Database         → Firebase Realtime Database (REST API via fetch)
Auth             → Custom token-based + OTP password reset
PDF Generation   → html-pdf
Dev Server       → ts-node-dev with hot reload
Build Tool       → TypeScript compiler (tsc)
Container        → Docker (multi-stage, Node 20 Alpine)
Deployment       → Render
```

---

## Architecture

```
src/
├── index.ts              # Express app entry — 59 route mounts, seed data, auth
├── firebase.ts           # Firebase RTDB REST utilities (get, set, push, remove, list)
├── routes/               # 59 route files (see table above)
├── data/
│   └── db.json           # Local reference database for development
```

---

## Quick Start

```bash
git clone <your-repo-url>
cd OP-CS_CONNECT_-Backend-

npm install

# Configure .env (FIREBASE_DATABASE_URL + FIREBASE_DATABASE_SECRET required)

npm run dev     # Development with hot reload
npm run build   # Production build
npm start       # Run production
```

---

## Environment Variables

| Variable | Required | What It Does |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project identifier |
| `FIREBASE_DATABASE_URL` | ✅ | Firebase Realtime DB endpoint |
| `FIREBASE_DATABASE_SECRET` | ✅ | Firebase DB secret for REST access |
| `CEREBRAS_API_KEY` | Optional | AI study plan generation |
| `GEMINI_API_KEY` | Optional | AI essay grading and chat |
| `GROQ_API_KEY` | Optional | AI fallback provider |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |

---

## API Endpoints

### System
```
GET  /api/health        → { status, service, version, timestamp }
POST /api/seed          → Seeds entire database with demo data
```

### Authentication
```
POST /api/auth/login           → { user, token }
POST /api/auth/signup          → { user, token }
POST /api/auth/forgot-password → { message, otp }
POST /api/auth/verify-otp      → { valid }
POST /api/auth/reset-password  → { message }
GET  /api/auth/me              → { user }
```

### Core Entities
```
GET/POST    /api/users          → List / Create users
GET/PUT/DEL /api/users/:id      → Read / Update / Delete user
GET         /api/students       → List students
GET         /api/teachers       → List teachers
GET/POST    /api/subjects       → List / Create subjects
GET/POST    /api/schools        → Multi-tenant school management
```

### Academic
```
GET/POST    /api/assignments    → Assignment CRUD + submissions
GET/POST    /api/grades         → Gradebook
GET/POST    /api/attendance     → Attendance records
GET/POST    /api/timetable      → Timetable management
GET/POST    /api/exams          → Exam management
GET/POST    /api/classroom      → Lesson plans, exercises
GET/POST    /api/question-bank  → Question repository
```

### Finance
```
GET/POST    /api/finance        → Chart of accounts, budgets
GET/POST    /api/fees           → Fee structures and payments
GET/POST    /api/payroll        → Payroll processing
GET/POST    /api/erp            → Products, orders, clients, invoices
```

### Communication
```
GET/POST    /api/messages        → Internal messaging
GET/POST    /api/notifications   → Notification system
GET/POST    /api/comms           → Announcements
GET/POST    /api/chat            → Real-time chat
GET/POST    /api/clubs           → Club management
```

### Student Life
```
GET/POST    /api/events          → School events
GET/POST    /api/achievements    → Recognition system
GET/POST    /api/accolades       → Accolade submission and approval
GET/POST    /api/study-plan      → AI study plans
GET/POST    /api/daily-briefing  → Daily morning briefing
GET/POST    /api/nexus           → Social feed
GET/POST    /api/portfolio       → Student e-portfolio
```

### Operations
```
GET/POST    /api/transport       → Bus routes and stops
GET/POST    /api/bus             → GPS tracking data
GET/POST    /api/library         → Book catalogue and borrowing
GET/POST    /api/facilities      → Room/facility bookings
GET/POST    /api/food-service    → Cafeteria management
GET/POST    /api/health          → Health records
GET/POST    /api/counselling     → Counselling sessions
GET/POST    /api/discipline      → Disciplinary records
```

---

## Docker Deployment

```bash
docker build -t eduvault-backend .
docker run -p 5000:5000 --env-file .env eduvault-backend
```

The Dockerfile uses a multi-stage build:
1. Builder stage installs dependencies and compiles TypeScript
2. Production stage installs only production dependencies and copies the compiled output
3. Final image runs on `node:20-alpine` — about 80MB

---

## Seed Data

`POST /api/seed` populates the database with demo data:

- 12 users across 8 roles
- 6 subjects, 8 assignments, 4 grade sets
- 4 attendance records, 4 fee structures
- 2 timetables, 2 bus routes
- Events, clubs, messages, notifications, announcements, books
- And more — accolades, achievements, leave requests, supply alerts, etc.

---

## By the Numbers

- 59 route modules
- 5 architecture phases
- ~500 lines of seed data
- 40+ entity types
- 12 demo users across 8 roles
- 1 database utility file powering everything
- 3 AI API integrations
- 0 ORMs, 0 external databases

---

## Security Notes

- Passwords are never returned in API responses
- Firebase DB secret is never exposed to clients
- CORS is enabled (restrict it in production)
- Request body limited to 10MB
- Token-based auth with `x-user-id` header verification
- OTP expires after 5 minutes

---

## A Note From Us

We built this as students trying to learn and create something meaningful. There are probably things we could have done better, and we're always looking to improve. If you have suggestions or find issues, we'd genuinely appreciate hearing from you.

This project taught us about Express, TypeScript, Firebase, Docker, and most importantly — that building something for others is the best way to learn.

---

Designed with love by **Navaneeth Nalabothu** and **Rishith Manchala**
Powered by AI