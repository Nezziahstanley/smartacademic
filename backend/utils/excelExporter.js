// ============================================================
// SMARTACADEMIC — Excel Exporter
// Generates .xlsx workbooks using exceljs.
// ============================================================

'use strict';

const ExcelJS = require('exceljs');

async function generateWorkbook({ title, columns, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SMARTACADEMIC';
  const ws = wb.addWorksheet(title.slice(0, 30) || 'Report');

  ws.columns = columns.map(c => ({
    header: c.label,
    key: c.key,
    width: c.width || 18,
  }));

  // Style header
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  ws.getRow(1).height = 22;

  // Rows
  rows.forEach(r => ws.addRow(r));

  return wb;
}

module.exports = { generateWorkbook };