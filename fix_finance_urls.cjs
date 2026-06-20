const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

code = code.replace(
  `app.get('/api/finance/chart-of-accounts'`,
  `app.get('/api/finance/accounts'`
);
code = code.replace(
  `app.post('/api/finance/chart-of-accounts'`,
  `app.post('/api/finance/accounts'`
);

code = code.replace(
  `app.get('/api/finance/journal-entries'`,
  `app.get('/api/finance/journal'`
);
code = code.replace(
  `app.post('/api/finance/journal-entries'`,
  `app.post('/api/finance/journal'`
);

fs.writeFileSync('src/index.ts', code);
