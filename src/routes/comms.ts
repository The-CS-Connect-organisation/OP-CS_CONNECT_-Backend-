import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Push Notifications (Phase 2) ---
router.post('/push/register', async (req, res) => {
  try {
    const { userId, token, platform } = req.body;
    const existing = await listData('pushTokens');
    const exists = existing.find((t: any) => t.token === token);
    if (!exists) {
      const pushToken = { id: id('pt'), userId, token, platform: platform || 'web', registeredAt: new Date().toISOString() };
      await setData(`pushTokens/${pushToken.id}`, pushToken);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

router.post('/push/send', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    const notification = {
      id: id('pn'), userId, title, body, data: data || {},
      sentAt: new Date().toISOString(), read: false,
    };
    await setData(`notifications/${userId}/${notification.id}`, notification);
    // In production: use FCM/web-push to send
    res.status(201).json(notification);
  } catch (e) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/push/broadcast', async (req, res) => {
  try {
    const { title, body, roles, data } = req.body;
    const users = await listData('users');
    const targets = roles ? users.filter((u: any) => roles.includes(u.role)) : users;
    const sent: string[] = [];
    for (const user of targets) {
      const notification = {
        id: id('pn'), title, body, data: data || {},
        sentAt: new Date().toISOString(), read: false, broadcast: true,
      };
      await setData(`notifications/${user.id}/${notification.id}`, notification);
      sent.push(user.id);
    }
    res.json({ success: true, count: sent.length, roles });
  } catch (e) {
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

// --- Emergency Alerts (Phase 2) ---
router.post('/emergency-alerts', async (req, res) => {
  try {
    const alert = {
      id: id('ea'), ...req.body, status: 'active',
      sentAt: new Date().toISOString(), acknowledged: [],
    };
    await setData(`emergencyAlerts/${alert.id}`, alert);
    // Broadcast to all users
    const users = await listData('users');
    for (const user of users) {
      const notification = {
        id: id('en'), title: '🚨 EMERGENCY: ' + (alert.title || 'Alert'),
        body: alert.message, type: 'emergency',
        sentAt: new Date().toISOString(), read: false, emergencyAlertId: alert.id,
      };
      await setData(`notifications/${user.id}/${notification.id}`, notification);
    }
    res.status(201).json(alert);
  } catch (e) {
    res.status(500).json({ error: 'Failed to send emergency alert' });
  }
});

router.get('/emergency-alerts', async (_req, res) => {
  try {
    const alerts = await listData('emergencyAlerts');
    res.json(alerts.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.put('/emergency-alerts/:id/acknowledge', async (req, res) => {
  try {
    const alert = await getData(`emergencyAlerts/${req.params.id}`);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    if (!alert.acknowledged) alert.acknowledged = [];
    if (!alert.acknowledged.includes(req.body.userId)) {
      alert.acknowledged.push(req.body.userId);
    }
    await setData(`emergencyAlerts/${req.params.id}`, alert);
    res.json(alert);
  } catch (e) {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

router.put('/emergency-alerts/:id/resolve', async (req, res) => {
  try {
    const alert = await getData(`emergencyAlerts/${req.params.id}`);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = req.body.resolvedBy;
    await setData(`emergencyAlerts/${req.params.id}`, alert);
    res.json(alert);
  } catch (e) {
    res.status(500).json({ error: 'Failed to resolve' });
  }
});

// --- Content Moderation (Phase 2) ---
router.post('/moderation/report', async (req, res) => {
  try {
    const report = { id: id('mr'), ...req.body, status: 'pending', reportedAt: new Date().toISOString() };
    await setData(`moderationReports/${report.id}`, report);
    res.status(201).json(report);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.get('/moderation/reports', async (req, res) => {
  try {
    let reports = await listData('moderationReports');
    const { status, contentType } = req.query;
    if (status) reports = reports.filter((r: any) => r.status === status);
    if (contentType) reports = reports.filter((r: any) => r.contentType === contentType);
    res.json(reports.sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.put('/moderation/reports/:id/review', async (req, res) => {
  try {
    const report = await getData(`moderationReports/${req.params.id}`);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.status = req.body.action === 'remove' ? 'removed' : 'dismissed';
    report.reviewedBy = req.body.reviewedBy;
    report.reviewedAt = new Date().toISOString();
    report.action = req.body.action;
    await setData(`moderationReports/${req.params.id}`, report);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// --- Email Sending (Phase 2) ---
router.post('/email/send', async (req, res) => {
  try {
    const { to, subject, body, cc, bcc } = req.body;
    const email = {
      id: id('em'), to, subject, body, cc, bcc,
      status: 'sent', sentAt: new Date().toISOString(),
    };
    await setData(`emailLog/${email.id}`, email);
    // Integrate with Resend/ SMTP here in production
    res.status(201).json(email);
  } catch (e) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.get('/email/log', async (req, res) => {
  try {
    let emails = await listData('emailLog');
    const { to, status } = req.query;
    if (to) emails = emails.filter((e: any) => e.to === to);
    if (status) emails = emails.filter((e: any) => e.status === status);
    res.json(emails.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch email log' });
  }
});

// --- Translation Templates (Phase 2) ---
router.post('/translations', async (req, res) => {
  try {
    const t = { id: id('tr'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`translations/${t.id}`, t);
    res.status(201).json(t);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add translation' });
  }
});

router.get('/translations', async (req, res) => {
  try {
    let translations = await listData('translations');
    const { locale, key } = req.query;
    if (locale) translations = translations.filter((t: any) => t.locale === locale);
    if (key) translations = translations.filter((t: any) => t.key === key);
    res.json(translations);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

export default router;
