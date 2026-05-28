// This file is a compatibility wrapper for Render deployments
// It redirects to the actual compiled entry point in dist/index.js
console.log('Starting server from compatibility wrapper...');

try {
  // Check if dist directory exists (build completed successfully)
  require('./dist/index.js');
} catch (error) {
  console.error('❌ ERROR: Could not load dist/index.js. Build may have failed.');
  console.error('Error details:', error.message);
  console.error('\nMake sure your build command runs "npm run build" to compile TypeScript.');
  process.exit(1);
}