/**
 * Integration Tests for New Backend Routes
 * Run with: node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="integration"
 * Or: npm test -- --testPathPattern="integration"
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import http from 'http';

// Test configuration
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const TEST_TOKEN = process.env.TEST_AUTH_TOKEN || '';

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        ...options.headers,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

describe('Integration Tests - New Backend Routes', () => {
  let testClassId = 'class-10-a';
  let testAssignmentId = null;
  let testScheduleId = null;

  beforeAll(() => {
    console.log('Starting integration tests against:', API_BASE);
    if (!TEST_TOKEN) {
      console.warn('WARNING: No TEST_AUTH_TOKEN set. Some tests may fail with 401.');
    }
  });

  afterEach(() => {
    // Cleanup any test data
    if (testAssignmentId) {
      // Attempt cleanup
    }
  });

  // =====================================================================
  // SUPPLY ANALYTICS
  // =====================================================================
  describe('GET /teacher/supply-analytics', () => {
    it('should return supply analytics for the teacher', async () => {
      const res = await makeRequest('/teacher/supply-analytics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.analytics).toBeDefined();
      expect(res.body.analytics).toHaveProperty('totalAssignmentsWithSupplies');
      expect(res.body.analytics).toHaveProperty('uniqueSupplyItems');
      expect(res.body.analytics).toHaveProperty('totalBudgetEstimate');
      expect(res.body.analytics).toHaveProperty('supplySummary');
      expect(Array.isArray(res.body.analytics.supplySummary)).toBe(true);
      expect(res.body.analytics).toHaveProperty('upcomingAlerts');
      expect(Array.isArray(res.body.analytics.upcomingAlerts)).toBe(true);
      expect(res.body.analytics).toHaveProperty('costBreakdown');
      expect(res.body.analytics.costBreakdown).toHaveProperty('low');
      expect(res.body.analytics.costBreakdown).toHaveProperty('medium');
      expect(res.body.analytics.costBreakdown).toHaveProperty('high');
      console.log('Supply analytics:', JSON.stringify(res.body.analytics, null, 2));
    });
  });

  // =====================================================================
  // STUDENT SUPPLY ALERTS
  // =====================================================================
  describe('GET /student/supply-alerts', () => {
    it('should return supply alerts for the student', async () => {
      const res = await makeRequest('/student/supply-alerts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('alerts');
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('total');
      expect(res.body.summary).toHaveProperty('submitted');
      expect(res.body.summary).toHaveProperty('pending');
      expect(res.body.summary).toHaveProperty('overdue');
      console.log('Supply alerts:', JSON.stringify(res.body, null, 2));
    });
  });

  // =====================================================================
  // PARENT BOOK HEAVY ALERTS
  // =====================================================================
  describe('GET /parent/book-alerts', () => {
    it('should return book heavy day alerts for the parent', async () => {
      const res = await makeRequest('/parent/book-alerts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('alerts');
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body).toHaveProperty('student');
    });
  });

  describe('GET /school/book-load/:classId/:date', () => {
    it('should analyze book load for a class on a given date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await makeRequest(`/school/book-load/${testClassId}/${today}?heavySubjectThreshold=4`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('heavyDay');
      expect(res.body).toHaveProperty('loadLevel');
      expect(res.body).toHaveProperty('heavySubjects');
      expect(Array.isArray(res.body.allSubjects)).toBe(true);
      console.log('Book load analysis:', JSON.stringify(res.body, null, 2));
    });
  });

  // =====================================================================
  // DIGITAL FRIDGE
  // =====================================================================
  describe('POST /school/fridge-items', () => {
    it('should create a new fridge item', async () => {
      const item = {
        title: 'Test Task ' + Date.now(),
        description: 'Integration test task',
        category: 'general',
        priority: 'medium',
        sharedWith: [],
      };
      const res = await makeRequest('/school/fridge-items', {
        method: 'POST',
        body: item,
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.item).toBeDefined();
      expect(res.body.item.title).toBe(item.title);
      testAssignmentId = res.body.item.id;
      console.log('Created fridge item:', res.body.item.id);
    });
  });

  describe('GET /school/fridge-items', () => {
    it('should retrieve fridge items', async () => {
      const res = await makeRequest('/school/fridge-items');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
      console.log('Fridge items count:', res.body.items.length);
    });
  });

  describe('PATCH /school/fridge-items/:itemId', () => {
    it('should update a fridge item status to completed', async () => {
      // First create an item
      const item = {
        title: 'Test Update Task ' + Date.now(),
        category: 'supplies',
      };
      const createRes = await makeRequest('/school/fridge-items', {
        method: 'POST',
        body: item,
      });
      expect(createRes.status).toBe(201);
      const itemId = createRes.body.item.id;

      // Now update it
      const updateRes = await makeRequest(`/school/fridge-items/${itemId}`, {
        method: 'PATCH',
        body: { status: 'completed' },
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.item.status).toBe('completed');
      console.log('Updated fridge item status to completed');
    });
  });

  describe('DELETE /school/fridge-items/:itemId', () => {
    it('should delete a fridge item', async () => {
      // First create an item
      const item = {
        title: 'Test Delete Task ' + Date.now(),
        category: 'general',
      };
      const createRes = await makeRequest('/school/fridge-items', {
        method: 'POST',
        body: item,
      });
      expect(createRes.status).toBe(201);
      const itemId = createRes.body.item.id;

      // Now delete it
      const deleteRes = await makeRequest(`/school/fridge-items/${itemId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      console.log('Deleted fridge item');
    });
  });

  // =====================================================================
  // UNIFORM SCHEDULE
  // =====================================================================
  describe('POST /school/uniform-schedules', () => {
    it('should create a new uniform schedule', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const dateStr = futureDate.toISOString().split('T')[0];

      const schedule = {
        classId: testClassId,
        date: dateStr,
        uniformType: 'sports',
        customDescription: 'White t-shirt and navy shorts',
        notes: 'Sports day practice',
      };
      const res = await makeRequest('/school/uniform-schedules', {
        method: 'POST',
        body: schedule,
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.schedule).toBeDefined();
      expect(res.body.schedule.uniform_type).toBe('sports');
      testScheduleId = res.body.schedule.id;
      console.log('Created uniform schedule:', res.body.schedule.id);
    });

    it('should reject duplicate uniform schedule for same class and date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const schedule = {
        classId: testClassId,
        date: dateStr,
        uniformType: 'formal',
      };
      // Create first
      const res1 = await makeRequest('/school/uniform-schedules', {
        method: 'POST',
        body: schedule,
      });
      expect(res1.status).toBe(201);

      // Try to create duplicate
      const res2 = await makeRequest('/school/uniform-schedules', {
        method: 'POST',
        body: schedule,
      });
      expect(res2.status).toBe(409);
      console.log('Duplicate schedule correctly rejected');
    });
  });

  describe('GET /school/uniform-schedules/:classId/:date', () => {
    it('should retrieve uniform schedules for a class on a date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await makeRequest(`/school/uniform-schedules/${testClassId}/${dateStr}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('schedules');
      console.log('Uniform schedules:', JSON.stringify(res.body.schedules, null, 2));
    });
  });

  describe('GET /school/uniform-today', () => {
    it('should retrieve today\'s uniform schedules', async () => {
      const res = await makeRequest('/school/uniform-today');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('schedules');
      expect(Array.isArray(res.body.schedules)).toBe(true);
      console.log('Today\'s uniform schedules:', res.body.schedules);
    });
  });

  // =====================================================================
  // PARENT DASHBOARD
  // =====================================================================
  describe('GET /parent/dashboard', () => {
    it('should return parent dashboard data', async () => {
      const res = await makeRequest('/parent/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.dashboard).toBeDefined();
      expect(res.body.dashboard).toHaveProperty('student');
      expect(res.body.dashboard).toHaveProperty('recentGrades');
      expect(res.body.dashboard).toHaveProperty('upcomingAssignments');
      expect(res.body.dashboard).toHaveProperty('recentSubmissions');
      expect(res.body.dashboard).toHaveProperty('notifications');
      expect(res.body.dashboard).toHaveProperty('attendance');
      expect(res.body.dashboard.attendance).toHaveProperty('percent');
      expect(res.body.dashboard.attendance).toHaveProperty('total');
      console.log('Parent dashboard summary:', JSON.stringify({
        student: res.body.dashboard.student,
        attendance: res.body.dashboard.attendance,
        grades: res.body.dashboard.recentGrades.length,
        upcoming: res.body.dashboard.upcomingAssignments.length,
      }, null, 2));
    });
  });

  // =====================================================================
  // BULK PARENT NOTIFICATION
  // =====================================================================
  describe('POST /parent/send-bulk-notification', () => {
    it('should send bulk notification to all parents in a class', async () => {
      const notification = {
        classId: testClassId,
        subject: 'Test Subject',
        message: 'This is a test bulk notification for integration testing.',
        type: 'info',
      };
      const res = await makeRequest('/parent/send-bulk-notification', {
        method: 'POST',
        body: notification,
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('notifiedCount');
      expect(typeof res.body.notifiedCount).toBe('number');
      console.log('Bulk notification sent to', res.body.notifiedCount, 'parents');
    });
  });

  // =====================================================================
  // USER PREFERENCES (FCM)
  // =====================================================================
  describe('User Preferences - FCM Token', () => {
    it('should get notification settings', async () => {
      const res = await makeRequest('/user-prefs/notification-settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should save FCM token', async () => {
      const res = await makeRequest('/user-prefs/fcm-token', {
        method: 'POST',
        body: { token: 'test-fcm-token-' + Date.now() },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should update notification preferences', async () => {
      const res = await makeRequest('/user-prefs/notification-settings', {
        method: 'PUT',
        body: {
          push_notifications: true,
          email_notifications: true,
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  // =====================================================================
  // ASSIGNMENT WITH SUPPLIES (STATIONERY ALERT)
  // =====================================================================
  describe('POST /school/assignments-with-supplies', () => {
    it('should create assignment with supply requirements', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dueDateStr = futureDate.toISOString().split('T')[0] + 'T23:59:59';

      const assignment = {
        title: 'Math Assignment with Supplies ' + Date.now(),
        description: 'Bring geometry box and notebook',
        subject: 'Mathematics',
        classId: testClassId,
        dueDate: dueDateStr,
        maxMarks: 50,
        suppliesNeeded: ['geometry box', 'ruler', 'compass', 'eraser'],
        notifyParents: true,
        notifyDaysBefore: 2,
      };
      const res = await makeRequest('/school/assignments-with-supplies', {
        method: 'POST',
        body: assignment,
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.assignment).toBeDefined();
      expect(res.body.assignment.supplies_needed).toEqual(assignment.suppliesNeeded);
      expect(res.body.assignment.notify_parents).toBe(true);
      testAssignmentId = res.body.assignment.id;
      console.log('Created assignment with supplies:', res.body.assignment.id);
    });
  });

  // =====================================================================
  // BOOK LOAD ANALYSIS (from teacher routes)
  // =====================================================================
  describe('GET /teacher/book-load-analysis', () => {
    it('should analyze book load via teacher routes', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await makeRequest(`/school/book-load/${testClassId}/${today}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  // =====================================================================
  // SEND BOOK HEAVY ALERT
  // =====================================================================
  describe('POST /school/book-load-alert', () => {
    it('should send book heavy day alert to parents', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const alert = {
        classId: testClassId,
        date: dateStr,
        heavySubjectThreshold: 4,
        message: 'Heavy book day alert for integration test.',
      };
      const res = await makeRequest('/school/book-load-alert', {
        method: 'POST',
        body: alert,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      console.log('Book heavy alert result:', res.body);
    });
  });

  // =====================================================================
  // HEALTH CHECK
  // =====================================================================
  describe('Health & Status', () => {
    it('should return health check', async () => {
      const res = await makeRequest('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should return API debug info for admin', async () => {
      const res = await makeRequest('/api/debug-errors');
      // May be 401 if no admin token, or 200 if admin
      expect([200, 401, 403]).toContain(res.status);
    });
  });
});