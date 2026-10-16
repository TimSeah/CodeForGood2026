import assert from 'node:assert/strict';
import test from 'node:test';
import { isoToday, parseIntervals } from '../src/dates.js';
import { extractMcFields } from '../src/mc.js';

test('Singapore local date, including near midnight UTC', () => {
  assert.equal(isoToday(new Date('2026-10-15T16:10:00Z')), '2026-10-16');
});

test('typed dates support single dates, inclusive ranges and merged overlaps', () => {
  assert.deepEqual(parseIntervals('17/10/2026, 18/10/2026 to 20/10/2026, 2026-10-25', '2026-10-16'), [
    { start: '2026-10-17', end: '2026-10-20' },
    { start: '2026-10-25', end: '2026-10-25' },
  ]);
});

test('rejects impossible, past, reversed, excessively long and ambiguous dates', () => {
  for (const input of ['31/02/2027', '15/10/2026', '20/10/2026 to 19/10/2026',
    '17/10/2026 to 19/10/2027', '10/11', '17/10/26']) {
    assert.throws(() => parseIntervals(input, '2026-10-16'), undefined, input);
  }
});

test('MC extracts only explicit absence dates, not an issue date', () => {
  const text = 'Patient Name: Alex Tan\nIssued: 16/10/2026\nUnfit for school from 17/10/2026 to 19/10/2026';
  assert.deepEqual(extractMcFields(text, '2026-10-16'), {
    name: 'Alex Tan', intervals: [{ start: '2026-10-17', end: '2026-10-19' }],
  });
  assert.deepEqual(extractMcFields('Patient Name: Alex Tan\nIssued: 16/10/2026', '2026-10-16').intervals, []);
  assert.deepEqual(extractMcFields('Valid from 16/10/2026 to 19/10/2026', '2026-10-16').intervals, []);
  assert.deepEqual(extractMcFields("Patient's Name: Alex Tan\nUnfit for work from 17 October 2026 to 19 October 2026", '2026-10-16').intervals,
    [{ start: '2026-10-17', end: '2026-10-19' }]);
  assert.deepEqual(extractMcFields('Unfit for work for 3 days from 17/10/2026', '2026-10-16').intervals,
    [{ start: '2026-10-17', end: '2026-10-19' }]);
});
