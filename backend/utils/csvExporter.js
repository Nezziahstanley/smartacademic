'use strict';

function toCSV(rows, headers = null) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = headers || Object.keys(rows[0]);

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map(c => escape(row[c])).join(','));
  }
  return lines.join('\n');
}

module.exports = { toCSV };