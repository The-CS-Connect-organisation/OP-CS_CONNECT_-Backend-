// Universal entry point for all deployment environments (Render, local, etc.)
// This ensures the app always works regardless of platform-specific requirements
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 EduVault AI Backend - Universal Starter');

// --- Build Step ---
// Check if the 'dist' directory exists. If not, run the build command.
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log("🔨 'dist' directory not found. Running 'npm run build'...");
  try {
    // Execute 'npm run build' synchronously.
    // stdio: 'inherit' will show the build output in the logs.
    execSync('npm run build', { stdio: 'inherit' });
    console.log("✅ Build completed successfully!");
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1); // Exit if build fails.
  }
} else {
  console.log("👍 'dist' directory already exists. Skipping build.");
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