// Universal entry point for all deployment environments (Render, local, etc.)
// This ensures the app always works regardless of platform-specific requirements
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 EduVault AI Backend - Universal Starter');

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