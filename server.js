// Universal entry point for all deployment environments (Render, local, etc.)
// This ensures the app always works regardless of platform-specific requirements
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 EduVault AI Backend - Universal Starter');

function sendDebugLog(runId, hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6a311b' },
    body: JSON.stringify({
      sessionId: '6a311b',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
}

// --- Build Step ---
// Check if the 'dist' directory exists. If not, run the build command.
const distPath = path.join(__dirname, 'dist');
const distExists = fs.existsSync(distPath);
// #region agent log
sendDebugLog('pre-fix', 'H1', 'server.js:dist-check', 'Checked dist directory status', {
  distPath,
  distExists,
  nodeVersion: process.version
});
// #endregion
if (!distExists) {
  console.log("🔨 'dist' directory not found. Running 'npm run build'...");
  // #region agent log
  sendDebugLog('pre-fix', 'H2', 'server.js:before-build', 'About to execute npm run build', {
    cwd: __dirname
  });
  // #endregion
  try {
    // Execute 'npm run build' synchronously.
    const buildOutput = execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
    if (buildOutput && buildOutput.trim()) {
      console.log(buildOutput);
    }
    // #region agent log
    sendDebugLog('pre-fix', 'H2', 'server.js:build-success', 'Build command completed', {
      outputTail: buildOutput ? buildOutput.slice(-800) : ''
    });
    // #endregion
    console.log("✅ Build completed successfully!");
  } catch (err) {
    const stdout = err && err.stdout ? String(err.stdout) : '';
    const stderr = err && err.stderr ? String(err.stderr) : '';
    // #region agent log
    sendDebugLog('pre-fix', 'H3', 'server.js:build-failure', 'Build command failed with error object', {
      name: err && err.name,
      message: err && err.message,
      status: err && err.status,
      signal: err && err.signal,
      stdoutTail: stdout.slice(-1500),
      stderrTail: stderr.slice(-1500)
    });
    // #endregion
    if (stdout.trim()) {
      console.error(stdout);
    }
    if (stderr.trim()) {
      console.error(stderr);
    }
    console.error('❌ Build failed:', err.message);
    process.exit(1); // Exit if build fails.
  }
} else {
  console.log("👍 'dist' directory already exists. Skipping build.");
}

// --- Start Step ---
// Now that the build is guaranteed to be complete, start the server.
console.log('🌐 Starting server from dist/index.js...');
// #region agent log
sendDebugLog('pre-fix', 'H4', 'server.js:before-require-dist', 'Attempting to require dist entrypoint', {
  distEntryPath: './dist/index.js'
});
// #endregion
try {
  require('./dist/index.js');
} catch (error) {
  // #region agent log
  sendDebugLog('pre-fix', 'H5', 'server.js:dist-require-failure', 'Failed requiring dist/index.js', {
    message: error && error.message,
    stackTail: error && error.stack ? String(error.stack).slice(-1500) : ''
  });
  // #endregion
  console.error('❌ ERROR: Could not start server from dist/index.js.');
  console.error('Error details:', error.message);
  process.exit(1);
}