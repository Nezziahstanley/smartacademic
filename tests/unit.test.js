'use strict';
const { scoreToGrade, computeTotal, isPass } = require('../backend/utils/gradeCalculator');
const { computeGPA, computeSemesterTrend, countFailed, computeGPADecline } = require('../backend/utils/gpaCalculator');
const { classify } = require('../backend/utils/riskClassifier');
const { toCSV } = require('../backend/utils/csvExporter');

describe('gradeCalculator', () => {
  test('scoreToGrade maps thresholds correctly', () => {
    expect(scoreToGrade(75).grade).toBe('A');
    expect(scoreToGrade(65).grade).toBe('B');
    expect(scoreToGrade(55).grade).toBe('C');
    expect(scoreToGrade(47).grade).toBe('D');
    expect(scoreToGrade(42).grade).toBe('E');
    expect(scoreToGrade(30).grade).toBe('F');
  });

  test('computeTotal applies 30/70 weighting', () => {
    expect(computeTotal(30, 70)).toBe(58);
    expect(computeTotal(25, 60)).toBe(49.5);
  });

  test('isPass is false only for F', () => {
    expect(isPass('A')).toBe(true);
    expect(isPass('E')).toBe(true);
    expect(isPass('F')).toBe(false);
  });
});

describe('gpaCalculator', () => {
  test('computeGPA returns weighted average', () => {
    const gpa = computeGPA([
      { units: 3, grade_point: 5 },
      { units: 3, grade_point: 4 },
      { units: 2, grade_point: 3 },
    ]);
    expect(gpa).toBe(4.13);
  });

  test('computeGPA handles empty input', () => {
    expect(computeGPA([])).toBe(0);
  });

  test('countFailed counts F grades', () => {
    expect(countFailed([
      { grade: 'A' }, { grade: 'F' }, { grade: 'F' }, { grade: 'C' },
    ])).toBe(2);
  });

  test('computeGPADecline detects drops', () => {
    const trend = [{ gpa: 4.0 }, { gpa: 3.0 }, { gpa: 2.5 }];
    expect(computeGPADecline(trend)).toBe(0.5);
  });
});

describe('riskClassifier', () => {
  test('classifies a perfect student as GREEN', () => {
    const { category, score } = classify({
      attendancePct: 95, caAvg: 28, examAvg: 65,
      failedCourses: 0, gpaDecline: 0,
    });
    expect(category).toBe('GREEN');
    expect(score).toBeLessThan(25);
  });

  test('classifies a struggling student as ORANGE or RED', () => {
    const { category } = classify({
      attendancePct: 55, caAvg: 15, examAvg: 30,
      failedCourses: 2, gpaDecline: 0.5,
    });
    expect(['ORANGE', 'RED']).toContain(category);
  });

  test('classifies a critical student as RED', () => {
    const { category } = classify({
      attendancePct: 30, caAvg: 10, examAvg: 20,
      failedCourses: 4, gpaDecline: 1.2,
    });
    expect(category).toBe('RED');
  });
});

describe('csvExporter', () => {
  test('escapes commas and quotes', () => {
    const csv = toCSV([{ name: 'Doe, John', note: 'He said "hi"' }]);
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""hi"""');
  });

  test('handles empty array', () => {
    expect(toCSV([])).toBe('');
  });
});