const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const updateBusRoute = `
app.put('/api/bus/assignments/:id', async (req, res) => {
  try {
    const existing = await getData(\`routes/\${req.params.id}\`);
    if (existing) {
      await setData(\`routes/\${req.params.id}\`, { ...existing, ...req.body });
      res.json({ success: true });
    } else {
      const data = await getData('busAssignments') as any;
      if (data && data[req.params.id]) {
        data[req.params.id] = { ...data[req.params.id], ...req.body };
        await setData('busAssignments', data);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});
`;

code = code.replace(
  `app.delete('/api/bus/assignments/:id'`,
  updateBusRoute + `\napp.delete('/api/bus/assignments/:id'`
);

fs.writeFileSync('src/index.ts', code);
