'use strict';
const PDFDocument = require('pdfkit');

/**
 * Generate a simple table-based PDF report.
 * @param {object} opts { title, subtitle, columns, rows, meta }
 * @returns {PDFDocument} a stream you can pipe to res
 */
function generateReport({ title, subtitle, columns, rows, meta = [] }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Header
  doc.fontSize(20).fillColor('#4f46e5').text('SMARTACADEMIC', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(14).fillColor('#0f172a').text(title || 'Report');
  if (subtitle) {
    doc.fontSize(10).fillColor('#64748b').text(subtitle);
  }
  doc.moveDown(0.8);

  // Meta lines
  if (meta.length) {
    meta.forEach(line => {
      doc.fontSize(9).fillColor('#334155').text(line);
    });
    doc.moveDown(0.6);
  }

  // Divider
  doc.strokeColor('#e2e8f0').lineWidth(1)
     .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.6);

  // Table header
  const colWidths = computeWidths(columns);
  const startX = 40;
  let y = doc.y;

  doc.fontSize(9).fillColor('#0f172a');
  columns.forEach((col, i) => {
    doc.text(col.label, startX + sum(colWidths, i), y, { width: colWidths[i], align: col.align || 'left' });
  });
  y += 18;
  doc.strokeColor('#e2e8f0').lineWidth(0.5)
     .moveTo(40, y - 3).lineTo(555, y - 3).stroke();

  // Rows
  doc.fontSize(8.5).fillColor('#334155');
  for (const row of rows) {
    if (y > 780) {
      doc.addPage();
      y = 60;
    }
    columns.forEach((col, i) => {
      const val = row[col.key] != null ? String(row[col.key]) : '';
      doc.text(val, startX + sum(colWidths, i), y, { width: colWidths[i], align: col.align || 'left' });
    });
    y += 15;
  }

  // Footer
  doc.fontSize(8).fillColor('#94a3b8')
     .text(`Generated ${new Date().toLocaleString()} — ${rows.length} records`,
           40, 800, { width: 515, align: 'center' });

  return doc;
}

function computeWidths(columns) {
  const total = 515;
  const sumWeights = columns.reduce((s, c) => s + (c.weight || 1), 0);
  return columns.map(c => ((c.weight || 1) / sumWeights) * total);
}

function sum(arr, upTo) {
  let s = 0;
  for (let i = 0; i < upTo; i++) s += arr[i];
  return s;
}

module.exports = { generateReport };