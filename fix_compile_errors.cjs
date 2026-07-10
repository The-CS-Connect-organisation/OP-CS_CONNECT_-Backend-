const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: GET /api/routes - add routesData back to destructuring and fix enriched mapping
const oldRoutes = `app.get('/api/routes', async (req, res) => {
  try {
    const [assignmentsData, usersData] = await Promise.all([getData('busAssignments'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const routes = routesData ? Object.values(routesData) as any[] : [];
    const assignments = assignmentsData ? Object.values(assignmentsData) as any[] : [];
    const all = [...routes, ...assignments];
    const enriched = assignments.map((r: any) => ({
      ...r,
      onLeave: !!(r?.driverId && users[r.driverId]?.onLeave),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});`;

const newRoutes = `app.get('/api/routes', async (req, res) => {
  try {
    const [routesData, assignmentsData, usersData] = await Promise.all([getData('routes'), getData('busAssignments'), getData('users')]);
    const users = (usersData || {}) as Record<string, any>;
    const routes = routesData ? Object.values(routesData) as any[] : [];
    const assignments = assignmentsData ? Object.values(assignmentsData) as any[] : [];
    const all = [...routes, ...assignments];
    const enriched = all.map((r: any) => ({
      ...r,
      onLeave: !!(r?.driverId && users[r.driverId]?.onLeave),
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});`;

if (content.includes(oldRoutes)) {
  content = content.replace(oldRoutes, newRoutes);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed GET /api/routes handler in index.ts');
} else if (content.includes("const [assignmentsData, usersData] = await Promise.all([getData('busAssignments'), getData('users')]);") && content.includes("const routes = routesData")) {
  console.log('⚠️  Routes handler pattern found but exact match failed - checking...');
  // Alternative: find the line and fix it via line-based approach
  
  const lines = content.split('\n');
  let changes = 0;
  
  for (let i = 0; i < lines.length; i++) {
    // Fix destructuring
    if (lines[i].includes("const [assignmentsData, usersData] = await Promise.all([getData('busAssignments'), getData('users')]);")) {
      if (!lines[i].includes("routesData")) {
        lines[i] = "    const [routesData, assignmentsData, usersData] = await Promise.all([getData('routes'), getData('busAssignments'), getData('users')]);";
        changes++;
      }
    }
    // Fix enriched to use 'all' instead of 'assignments'
    if (lines[i].trim().startsWith("const enriched = assignments.map(")) {
      lines[i] = lines[i].replace("const enriched = assignments.map(", "const enriched = all.map(");
      changes++;
    }
  }
  
  if (changes > 0) {
    content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Made ${changes} fixes in index.ts`);
  } else {
    console.log('❌ Could not find the patterns to fix');
  }
} else {
  console.log('❌ Could not find the routes handler to fix');
}

// Verify the fix
const final = fs.readFileSync(filePath, 'utf8');
const routesSection = final.substring(final.indexOf("// ==================== ROUTES"), final.indexOf("// ==================== ROUTES") + 800);
console.log('\n--- Fixed section ---');
console.log(routesSection);
