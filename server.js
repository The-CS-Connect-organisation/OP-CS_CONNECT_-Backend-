// Universal entry point for all deployment environments (Render, local, etc.)
// This ensures the app always works regardless of platform-specific requirements
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 EduVault AI Backend - Universal Starter');

// --- ALWAYS Clean & Build Step ---
// Clean dist folder first, then rebuild EVERY time
const distPath = path.join(__dirname, 'dist');
console.log("🧹 Cleaning dist folder...");
try {
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log("✅ dist folder cleaned!");
  }
} catch (err) {
  console.error("⚠️  Warning: Couldn't clean dist folder, continuing anyway...", err.message);
}

console.log("🔨 Building backend...");
try {
  // Execute 'npm run build' synchronously.
  // stdio: 'inherit' will show the build output in the logs.
  execSync('npm run build', { stdio: 'inherit' });
  console.log("✅ Build completed successfully!");
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1); // Exit if build fails.
}

// --- Start Step ---
// Now that the build is guaranteed to be complete, start the server.
console.log('🌐 Starting server from dist/index.js...');
try {
  require('./dist/index.js');
} catch (error) {
  console.error('❌ ERROR: Could not start server from dist/index.js.');
  console.error('Error details:', error.message);
  process.exit(1);
}