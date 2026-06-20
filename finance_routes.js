const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const additionalRoutes = `
// ==================== FINANCE ====================
app.get('/api/finance/chart-of-accounts', async (req, res) => {
  try { res.json(await listData('finance/chartOfAccounts')); } catch (error) { res.status(500).json({ error: 'Failed to fetch' }); }
});
app.post('/api/finance/chart-of-accounts', async (req, res) => {
  try { const id = await pushData('finance/chartOfAccounts', req.body); res.json({ id }); } catch (error) { res.status(500).json({ error: 'Failed to create' }); }
});

app.get('/api/finance/journal-entries', async (req, res) => {
  try { res.json(await listData('finance/journalEntries')); } catch (error) { res.status(500).json({ error: 'Failed to fetch' }); }
});
app.post('/api/finance/journal-entries', async (req, res) => {
  try { const id = await pushData('finance/journalEntries', req.body); res.json({ id }); } catch (error) { res.status(500).json({ error: 'Failed to create' }); }
});

app.get('/api/finance/budgets', async (req, res) => {
  try { res.json(await listData('finance/budgets')); } catch (error) { res.status(500).json({ error: 'Failed to fetch' }); }
});
app.post('/api/finance/budgets', async (req, res) => {
  try { const id = await pushData('finance/budgets', req.body); res.json({ id }); } catch (error) { res.status(500).json({ error: 'Failed to create' }); }
});

app.get('/api/finance/financial-aid', async (req, res) => {
  try { res.json(await listData('finance/financialAid')); } catch (error) { res.status(500).json({ error: 'Failed to fetch' }); }
});
app.post('/api/finance/financial-aid', async (req, res) => {
  try { const id = await pushData('finance/financialAid', req.body); res.json({ id }); } catch (error) { res.status(500).json({ error: 'Failed to create' }); }
});

app.get('/api/finance/spending-analytics', async (req, res) => {
  try { res.json(await listData('finance/spendingAnalytics')); } catch (error) { res.status(500).json({ error: 'Failed to fetch' }); }
});
`;

code = code.replace(`// ==================== SIS ENDPOINTS ====================`, additionalRoutes + `\n// ==================== SIS ENDPOINTS ====================`);

fs.writeFileSync('src/index.ts', code);
