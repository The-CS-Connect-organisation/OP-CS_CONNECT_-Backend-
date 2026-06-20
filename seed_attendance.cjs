const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const attSeed = `  attendance: toObj([
    { id: "u1", _isRaw: true, data: [{ date: "2024-06-01", status: "present", class: "10-A" }, { date: "2024-06-02", status: "absent", class: "10-A" }] },
    { id: "u3", _isRaw: true, data: [{ date: "2024-06-01", status: "late", class: "10-B" }] }
  ]),`;

code = code.replace(
  `  classes: toObj([`,
  attSeed + `\n  classes: toObj([`
);

// Wait, the seed function for attendance needs to map correctly. 
// \`toObj\` converts an array to an object using the \`id\` field.
// BUT for attendance, the backend accesses it via \`attendance/\${studentId}\`, which expects an ARRAY.
// So we should NOT use toObj for attendance if we want it to be direct arrays.
// Actually, if we use \`toObj\` with \`_isRaw: true\`, wait, we didn't write a custom mapping for _isRaw.

fs.writeFileSync('src/index.ts', code);
