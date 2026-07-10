const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

const search = `const [routesData, assignmentsData, usersData] = await Promise.all([getData('routes'), getData('busAssignments'), getData('users')]);`;
const replace = `const [assignmentsData, usersData] = await Promise.all([getData('busAssignments'), getData('users')]);`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  
  // Also remove the routes line
  const routesLine = `const routes = routesData ? Object.values(routesData) as any[] : [];`;
  const allLine = `const all = [...routes, ...assignments];`;
  const enrichedLine = `const enriched = all.map((r: any) => ({`;
  
  content = content.replace(routesLine + '\n    ', '');
  content = content.replace(allLine + '\n    ', '');
  content = content.replace(enrichedLine, `const enriched = assignments.map((r: any) => ({`);
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed GET /api/bus/assignments handler - removed routes merging');
} else {
  console.log('❌ Could not find the pattern to replace');
  // Debug: show what's around
  const idx = content.indexOf("getData('routes')");
  if (idx >= 0) {
    console.log('Found getData routes at:', idx);
    console.log('Context:', content.substring(idx - 50, idx + 100));
  }
}
