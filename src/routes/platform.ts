import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Workflows ---
router.get('/workflows', async (req, res) => {
  try {
    let workflows = await listData('platformWorkflows');
    const { trigger, enabled } = req.query;
    if (trigger) workflows = workflows.filter((w: any) => w.trigger === trigger);
    if (enabled !== undefined) workflows = workflows.filter((w: any) => String(w.enabled) === enabled);
    res.json(workflows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

router.post('/workflows', async (req, res) => {
  try {
    const workflow = { id: id('pwf'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`platformWorkflows/${workflow.id}`, workflow);
    res.status(201).json(workflow);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

router.put('/workflows/:id', async (req, res) => {
  try {
    const existing = await getData(`platformWorkflows/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`platformWorkflows/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// --- System Tasks ---
router.get('/tasks', async (req, res) => {
  try {
    let tasks = await listData('platformTasks');
    const { assignedTo, priority, status } = req.query;
    if (assignedTo) tasks = tasks.filter((t: any) => t.assignedTo === assignedTo);
    if (priority) tasks = tasks.filter((t: any) => t.priority === priority);
    if (status) tasks = tasks.filter((t: any) => t.status === status);
    res.json(tasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const task = { id: id('ptsk'), ...req.body, status: req.body.status || 'pending', createdAt: new Date().toISOString() };
    await setData(`platformTasks/${task.id}`, task);
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const existing = await getData(`platformTasks/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`platformTasks/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.put('/tasks/:id/complete', async (req, res) => {
  try {
    const task = await getData(`platformTasks/${req.params.id}`);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.completedBy = req.body.completedBy;
    await setData(`platformTasks/${req.params.id}`, task);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// --- System Configuration ---
router.get('/config', async (req, res) => {
  try {
    const config = await getData('platformConfig');
    const { category } = req.query;
    if (category && config) {
      return res.json(Object.fromEntries(Object.entries(config).filter(([_, v]: any) => v.category === category)));
    }
    res.json(config || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/config', async (req, res) => {
  try {
    const { key, value, description, category } = req.body;
    const config = await getData('platformConfig') || {};
    config[key] = { value, description: description || '', category: category || 'general', updatedAt: new Date().toISOString() };
    await setData('platformConfig', config);
    res.status(201).json({ key, ...config[key] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to set config value' });
  }
});

// --- Multi-Tenant Schools ---
router.get('/multitenant/schools', async (_req, res) => {
  try {
    const schools = await listData('platformSchools');
    res.json(schools);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

router.post('/multitenant/schools', async (req, res) => {
  try {
    const school = { id: id('psch'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`platformSchools/${school.id}`, school);
    res.status(201).json(school);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add school' });
  }
});

// --- Households ---
router.get('/households', async (req, res) => {
  try {
    let households = await listData('platformHouseholds');
    const { primaryContact } = req.query;
    if (primaryContact) households = households.filter((h: any) => h.primaryContact === primaryContact);
    res.json(households);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch households' });
  }
});

router.post('/households', async (req, res) => {
  try {
    const household = { id: id('phh'), ...req.body, members: req.body.members || [], createdAt: new Date().toISOString() };
    await setData(`platformHouseholds/${household.id}`, household);
    res.status(201).json(household);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create household' });
  }
});

router.put('/households/:id', async (req, res) => {
  try {
    const existing = await getData(`platformHouseholds/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Household not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`platformHouseholds/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update household' });
  }
});

router.post('/households/:id/members', async (req, res) => {
  try {
    const household = await getData(`platformHouseholds/${req.params.id}`);
    if (!household) return res.status(404).json({ error: 'Household not found' });
    const members = household.members || [];
    members.push({ ...req.body, addedAt: new Date().toISOString() });
    household.members = members;
    await setData(`platformHouseholds/${req.params.id}`, household);
    res.json(household);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add household member' });
  }
});

// --- System Surveys ---
router.get('/surveys', async (req, res) => {
  try {
    let surveys = await listData('platformSurveys');
    const { targetAudience, status } = req.query;
    if (targetAudience) surveys = surveys.filter((s: any) => s.targetAudience === targetAudience);
    if (status) surveys = surveys.filter((s: any) => s.status === status);
    res.json(surveys);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

router.post('/surveys', async (req, res) => {
  try {
    const survey = { id: id('psvy'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`platformSurveys/${survey.id}`, survey);
    res.status(201).json(survey);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create survey' });
  }
});

router.post('/surveys/:id/response', async (req, res) => {
  try {
    const survey = await getData(`platformSurveys/${req.params.id}`);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    const response = { id: id('psvr'), surveyId: req.params.id, ...req.body, submittedAt: new Date().toISOString() };
    await setData(`platformSurveyResponses/${response.id}`, response);
    res.status(201).json(response);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit survey response' });
  }
});

// --- CRM ---
router.get('/crm', async (req, res) => {
  try {
    let contacts = await listData('platformCrm');
    const { source, status } = req.query;
    if (source) contacts = contacts.filter((c: any) => c.source === source);
    if (status) contacts = contacts.filter((c: any) => c.status === status);
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch CRM contacts' });
  }
});

router.post('/crm', async (req, res) => {
  try {
    const contact = { id: id('pcrm'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`platformCrm/${contact.id}`, contact);
    res.status(201).json(contact);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create CRM contact' });
  }
});

router.put('/crm/:id', async (req, res) => {
  try {
    const existing = await getData(`platformCrm/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`platformCrm/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update CRM contact' });
  }
});

// --- Documents ---
router.get('/documents', async (req, res) => {
  try {
    let docs = await listData('platformDocuments');
    const { category, tag } = req.query;
    if (category) docs = docs.filter((d: any) => d.category === category);
    if (tag) docs = docs.filter((d: any) => d.tags?.includes(tag));
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const doc = { id: id('pdoc'), ...req.body, uploadedAt: new Date().toISOString() };
    await setData(`platformDocuments/${doc.id}`, doc);
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const existing = await getData(`platformDocuments/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    const { removeData } = await import('../firebase');
    await removeData(`platformDocuments/${req.params.id}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// --- Bulk Operations ---
router.get('/bulk-operations', async (req, res) => {
  try {
    let ops = await listData('platformBulkOps');
    const { type } = req.query;
    if (type) ops = ops.filter((o: any) => o.type === type);
    res.json(ops.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bulk operations' });
  }
});

router.post('/bulk-operations', async (req, res) => {
  try {
    const op = { id: id('pbo'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`platformBulkOps/${op.id}`, op);
    // Simulate async processing
    setTimeout(async () => {
      op.status = 'completed';
      op.completedAt = new Date().toISOString();
      op.result = { processed: Array.isArray(op.data) ? op.data.length : 0, errors: [] };
      await setData(`platformBulkOps/${op.id}`, op);
    }, 100);
    res.status(201).json(op);
  } catch (e) {
    res.status(500).json({ error: 'Failed to execute bulk operation' });
  }
});

export default router;
