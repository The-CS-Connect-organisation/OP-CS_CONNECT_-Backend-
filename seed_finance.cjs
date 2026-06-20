const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const financeSeed = `  finance: {
    chartOfAccounts: toObj([
      { id: "acc1", code: "1000", name: "Cash and Bank", type: "asset", normalBalance: "debit" },
      { id: "acc2", code: "2000", name: "Accounts Payable", type: "liability", normalBalance: "credit" },
      { id: "acc3", code: "4000", name: "Tuition Revenue", type: "revenue", normalBalance: "credit" },
      { id: "acc4", code: "5000", name: "Staff Salaries", type: "expense", normalBalance: "debit" }
    ]),
    journalEntries: toObj([
      { id: "je1", date: "2024-03-01", description: "Monthly Tuition Income", debits: [{ account: "acc1", amount: 50000 }], credits: [{ account: "acc3", amount: 50000 }], totalDebit: 50000, totalCredit: 50000 }
    ]),
    budgets: toObj([
      { id: "bg1", name: "IT Equipment", category: "Technology", allocated: 20000, spent: 5000, fiscalYear: "2024", status: "active" },
      { id: "bg2", name: "Library Books", category: "Academic", allocated: 10000, spent: 9500, fiscalYear: "2024", status: "warning" }
    ]),
    financialAid: toObj([
      { id: "fa1", studentName: "Arjun Reddy", amount: 5000, type: "Scholarship", status: "approved", date: "2024-01-15" }
    ]),
    spendingAnalytics: toObj([
      { id: "sa1", month: "Jan", salaries: 40000, facilities: 10000, supplies: 5000, total: 55000 },
      { id: "sa2", month: "Feb", salaries: 40000, facilities: 12000, supplies: 4000, total: 56000 },
      { id: "sa3", month: "Mar", salaries: 40000, facilities: 9000, supplies: 6000, total: 55000 }
    ])
  },`;

code = code.replace(
  `  classes: toObj([`,
  financeSeed + `\n  classes: toObj([`
);

fs.writeFileSync('src/index.ts', code);
