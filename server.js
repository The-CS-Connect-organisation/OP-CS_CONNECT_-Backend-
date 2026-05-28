// This file is a compatibility wrapper for Render deployments
// It redirects to the actual compiled entry point in dist/index.js
console.log('Starting server from compatibility wrapper...');
require('./dist/index.js');