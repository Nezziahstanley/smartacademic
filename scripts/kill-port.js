// ============================================================
// SMARTACADEMIC — Port Killer
// Usage: node scripts/kill-port.js 5000
// Frees a port that's stuck (EADDRINUSE) by killing the process.
// ============================================================

'use strict';

const { execSync } = require('child_process');
const port = process.argv[2] || '5000';

console.log(`[kill-port] Looking for process on port ${port}...`);

try {
  // netstat -ano lists all connections with PIDs
  const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const pids = new Set();

  out.split('\n').forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid);
    }
  });

  if (!pids.size) {
    console.log(`[kill-port] ✅ Port ${port} is free`);
    process.exit(0);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`[kill-port] Killed PID ${pid}`);
    } catch (e) {
      console.log(`[kill-port] PID ${pid} already gone`);
    }
  }

  console.log(`[kill-port] ✅ Port ${port} freed`);
} catch (err) {
  // findstr returns exit code 1 when nothing matches — that's OK
  console.log(`[kill-port] ✅ Port ${port} is free`);
  process.exit(0);
}