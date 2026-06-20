const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const additionalRoutes = `
app.get('/api/hr/staff', async (req, res) => {
  try { res.json(await listData('users')); } catch (error) { res.status(500).json({ error: 'Failed' }); }
});
app.get('/api/hr/attendance', async (req, res) => {
  try { res.json(await listData('hr/attendance')); } catch (error) { res.status(500).json({ error: 'Failed' }); }
});
app.get('/api/hr/leave', async (req, res) => {
  try { res.json(await listData('leaveRequests')); } catch (error) { res.status(500).json({ error: 'Failed' }); }
});
`;

code = code.replace(
  `app.post('/api/hr/staff', async (req, res) => {`,
  additionalRoutes + `\napp.post('/api/hr/staff', async (req, res) => {`
);

fs.writeFileSync('src/index.ts', code);
