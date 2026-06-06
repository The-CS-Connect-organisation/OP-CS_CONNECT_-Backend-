// Universal entry point for all deployment environments (Render, local, etc.)
// This ensures the app always works regardless of platform-specific requirements
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('EduVault AI Backend - Universal Starter');

// --- Build Step (if dist doesn't exist) ---
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(path.join(distPath, 'index.js'))) {
  console.log('No built output found. Building backend...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('Using existing build. Set FORCE_REBUILD=true to force rebuild.');
}

// --- Start Step ---
console.log('Starting server from dist/index.js...');
try {
  require('./dist/index.js');
} catch (error) {
  console.error('ERROR: Could not start server from dist/index.js.');
  console.error('Error details:', error.message);
  process.exit(1);
}