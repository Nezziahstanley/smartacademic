// CLI: run the risk engine from the terminal
// Usage: node scripts/run-risk-engine.js
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const riskEngine = require('../backend/services/riskEngine');
const db = require('../backend/config/db');

(async () => {
  try {
    console.log('[risk] Running full recompute...');
    const info = await riskEngine.fullRecompute({});
    console.log(`[risk] ✅ Results updated: ${info.results.updated}`);
    console.log(`[risk] ✅ Students assessed: ${info.risk.count}`);
    console.log(`[risk] ✅ Session: ${info.risk.sessionId}, Semester: ${info.risk.semesterId}`);
  } catch (err) {
    console.error('[risk] ❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();