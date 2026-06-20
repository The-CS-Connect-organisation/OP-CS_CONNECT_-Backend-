const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const hrSeed = `  leaveRequests: toObj([
    { id: "lr1", userId: "u6", name: "Anand Verma", role: "teacher", type: "Sick Leave", startDate: "2024-06-20", endDate: "2024-06-22", status: "pending", reason: "Fever" },
    { id: "lr2", userId: "u12", name: "Ramesh Iyer", role: "staff", type: "Casual Leave", startDate: "2024-07-01", endDate: "2024-07-02", status: "approved", reason: "Family event" }
  ]),
  hr: {
    recruitment: toObj([
      { id: "job1", title: "Senior Math Teacher", department: "Academics", type: "Full-time", location: "Main Campus", status: "open", applicants: 12, postedDate: "2024-05-15" },
      { id: "job2", title: "Librarian", department: "Support", type: "Part-time", location: "North Campus", status: "closed", applicants: 5, postedDate: "2024-04-10" }
    ]),
    onboarding: toObj([
      { id: "ob1", name: "Suresh Kumar", role: "Physics Teacher", department: "Science", startDate: "2024-07-01", status: "in-progress", completionPercentage: 60 }
    ]),
    payroll: toObj([
      { id: "pr1", month: "May 2024", processedDate: "2024-05-28", totalAmount: 450000, status: "completed", employees: 42 }
    ])
  },`;

code = code.replace(
  `  finance: {`,
  hrSeed + `\n  finance: {`
);

fs.writeFileSync('src/index.ts', code);
