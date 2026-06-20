const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const sisSeed = `  studentTransfers: toObj([
    { id: "tr1", studentId: "u1", studentName: "Rahul Sharma", fromClass: "10-A", toClass: "10-B", reason: "Parent Request", transferredBy: "Admin", transferredAt: "2024-05-10" }
  ]),
  families: toObj([
    { id: "fam1", name: "Sharma Family", primaryContact: "Rajesh Sharma", phone: "9876543210", email: "rajesh@example.com", address: "123 Main St", students: ["u1"], createdAt: "2024-01-01" }
  ]),
  lockers: toObj([
    { id: "lk1", number: "101", location: "North Wing", assignedTo: "u1", assignedAt: "2024-05-01", createdAt: "2024-01-01" },
    { id: "lk2", number: "102", location: "North Wing", createdAt: "2024-01-01" }
  ]),
  promotions: toObj([
    { id: "promo1", fromClass: "9-A", toClass: "10-A", criteria: "Passed all subjects", studentIds: ["u1", "u2"], status: "executed", createdAt: "2024-04-01" }
  ]),
  transferCertificates: toObj([
    { id: "tc1", studentId: "u3", reason: "Relocation", destinationSchool: "DPS", status: "issued", issuedAt: "2024-05-20", certificateNo: "TC-2024-001" }
  ]),`;

code = code.replace(
  `  classes: toObj([`,
  sisSeed + `\n  classes: toObj([`
);

fs.writeFileSync('src/index.ts', code);
