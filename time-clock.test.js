import test from 'node:test';
import assert from 'node:assert/strict';
import { recordShift, validateShifts, perthBoundaries, totalTime, duration, toCsv } from './time-clock.js';

const start = Date.parse('2026-11-08T15:00:00Z');
const shift = { id: 'one', employeeId: 'K001', start, end: null };
const input = { employeeId: ' k001 ', action: 'in', now: start, id: 'one' };

test('clock in normalizes identity and clock out preserves the original record', () => {
  const shifts = recordShift([], input);
  assert.deepEqual(shifts, [shift]);
  const ended = recordShift(shifts, { ...input, action: 'out', now: start + 3_600_000 });
  assert.deepEqual(ended, [{ ...shift, end: start + 3_600_000 }]);
  assert.equal(shifts[0].end, null);
  assert.equal(duration(ended[0].end - start), '1h 00m');
});

test('rejects duplicate clock ins, missing clock outs and backwards device time', () => {
  assert.throws(() => recordShift([shift], input), /already clocked in/);
  assert.throws(() => recordShift([], { ...input, action: 'out' }), /not clocked in/);
  assert.throws(() => recordShift([shift], { ...input, action: 'out', now: start - 1 }), /device clock/);
  assert.throws(() => recordShift([{ ...shift, end: start + 100 }], { ...input, id: 'two' }), /device clock/);
});

test('different employees can work simultaneously and invalid identity is rejected', () => {
  assert.equal(recordShift([shift], { ...input, employeeId: 'K002', id: 'two' }).length, 2);
  assert.throws(() => recordShift([], { ...input, employeeId: ' ' }), /employee ID/);
  assert.throws(() => recordShift([], { ...input, employeeId: '<script>' }), /employee ID/);
});

test('Perth Monday boundaries split an overnight Sunday shift', () => {
  const now = Date.parse('2026-11-08T17:00:00Z');
  const { today, week } = perthBoundaries(now);
  assert.equal(today, Date.parse('2026-11-08T16:00:00Z'));
  assert.equal(week, today);
  assert.equal(totalTime([shift], today, now), 3_600_000);
  assert.equal(totalTime([{ ...shift, end: today - 1 }], today, now), 0);
  assert.equal(perthBoundaries(Date.parse('2026-11-14T17:00:00Z')).week, week);
});

test('totals clip completed shifts and floor partial minutes', () => {
  assert.equal(totalTime([{ ...shift, end: start + 7_200_000 }], start + 3_600_000, start + 5_400_000), 1_800_000);
  assert.equal(duration(3_659_999), '1h 00m');
  assert.equal(duration(-1000), '0h 00m');
});

test('invalid saved data cannot be silently accepted', () => {
  for (const value of [{}, [null], [{ ...shift, start: 'bad' }], [{ ...shift, end: start - 1 }], [shift, shift], [shift, { ...shift, id: 'two' }]]) {
    assert.throws(() => validateShifts(value));
  }
  assert.deepEqual(validateShifts([]), []);
});

test('CSV prevents spreadsheet formulas and labels active shifts', () => {
  const csv = toCsv([{ ...shift, employeeId: '-K001' }], start + 90_000);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(`"'-K001"`));
  assert.ok(csv.includes('"1","Active"'));
  assert.ok(toCsv([{ ...shift, end: start + 3_600_000 }], start).includes('"60","Complete"'));
});
