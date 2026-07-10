const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start and end of the GET handler
const startMarker = "app.get('/api/bus/assignments', async (_req, res) => {";
const endMarker = `});`;

let startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('❌ Could not find start marker');
  process.exit(1);
}

// Find the matching end - we need to find the 4th closing brace
// The handler has: try { ... } catch (error) { ... } }); 
// We need to find the }); that closes the app.get
let searchFrom = startIdx + startMarker.length;
let braceCount = 0;
let foundOpenBrace = false;
let endIdx = -1;

for (let i = startIdx; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    foundOpenBrace = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (foundOpenBrace && braceCount === 0) {
      // Found the closing brace of the try block's catch's outer
      // Actually the structure is:
      // app.get(..., async () => {
      //   try {
      //     ...
      //   } catch (error) {
      //     ...
      //   }
      // });
      // So we need to go past `});`
      // After braceCount hits 0, we need to find the `});` that closes app.get
      endIdx = i + 1;
      // Look ahead for `);`
      const rest = content.substring(i + 1, i + 5);
      if (rest.startsWith(');')) {
        endIdx = i + 3;
        break;
      }
    }
  }
  if (foundOpenBrace && braceCount === 0 && i > startIdx + 10) {
    // Check if this is followed by ); 
    const after = content.substring(i + 1, i + 3);
    if (after === ');') {
      endIdx = i + 3;
      break;
    }
  }
}

if (endIdx === -1) {
  console.log('❌ Could not find end of handler');
  process.exit(1);
}

const oldBlock = content.substring(startIdx, endIdx);
console.log('Found handler block:');
console.log(oldBlock.substring(0, 200) + '...');

const newBlock = `app.get('/api/bus/assignments', async (_req, res) => {
  try {
    const [assignmentsData, usersData] = await Promise.all([getData('busAssignments'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const assignments = assignmentsData ? Object.values(assignmentsData) as any[] : [];
    const enriched = assignments.map((r: any) => ({
      ...r,
      onLeave: !!(r?.driverId && users[r.driverId]?.onLeave),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bus assignments' });
  }
});`;

content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully replaced GET /api/bus/assignments handler');
