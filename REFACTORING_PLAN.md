# Backend Refactoring and Consolidation Plan

This document outlines the strategy for refactoring the backend to resolve unwired endpoints, redundant code, and the bloated `index.ts`.

## 1. Objectives
- **Reduce `index.ts` Bloat:** Move over 2,000 lines of inline route handlers to dedicated route files.
- **Eliminate Redundancy:** Use centralized Firebase helpers from `firebase.ts`.
- **Wire All Endpoints:** Ensure all Phase 1-4 route modules and Analytics are active.
- **Standardize Responses:** Use consistent error handling and response formats across all routes.

## 2. Refactoring Strategy

### Phase 1: Preparation
- [ ] Ensure `firebase.ts` has all necessary utility functions (`getData`, `setData`, `listData`, `id`, `safeUser`, `removeData`).
- [ ] Identify all inline handlers in `index.ts` and map them to their corresponding file in `src/routes/`.

### Phase 2: Route Consolidation
- **Auth & Users:**
  - [ ] Move login, signup, reset-password logic to `routes/auth.ts`.
  - [ ] Move user CRUD and avatar updates to `routes/users.ts`.
- **Academic & SIS:**
  - [ ] Move student, teacher, and subject logic to `routes/students.ts`, `routes/teachers.ts`, and `routes/subjects.ts`.
  - [ ] Move assignment, grade, and attendance logic to their respective files.
- **Admin & Infrastructure:**
  - [ ] Move dashboard, circulars, and announcements logic.
  - [ ] Move transport (bus), library, and erp logic.
- **Phase 3 & 4:**
  - [ ] Ensure Counselling, Health, Discipline, etc., are correctly handled in their files.

### Phase 3: index.ts Refactoring
- [ ] Remove inline route handlers from `index.ts`.
- [ ] Import all route modules.
- [ ] Register all routes using `app.use('/api/...')`.
- [ ] Ensure middleware (CORS, Request Logger, Auth) is correctly applied.
- [ ] Keep only essential initialization code (Socket.io setup, Seed logic) in `index.ts`.

### Phase 4: Analytics Integration
- [ ] Wire `analyticsRoutes` to `/api/analytics`.
- [ ] Verify that frontend calls to `/api/analytics/admin` and `/api/analytics/teacher` are successful.

## 3. Validation
- [ ] Run `tsc` to verify type safety and missing imports.
- [ ] Verify that the `seedDatabase` logic still works and covers all essential collections.
- [ ] Spot-check key endpoints (Login, Dashboard Stats, Student List) using a tool like `curl` or by checking frontend connectivity.

## 4. Risks & Mitigations
- **Breaking Changes:** Consolidating routes might change response structures.
  - *Mitigation:* Carefully match the response format expected by the frontend `api.ts`.
- **Missing Data:** Inline handlers might have used different Firebase paths.
  - *Mitigation:* Audit path strings before migration.
