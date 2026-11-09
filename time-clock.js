export const STORAGE_KEY = 'kenji.shifts.v1';
export const PERTH_ZONE = 'Australia/Perth';
const DAY = 86_400_000;
const OFFSET = 8 * 3_600_000;

export function normalizeId(value) {
  return value.trim().toUpperCase();
}

export function validateShifts(value) {
  if (!Array.isArray(value)) throw new Error('Saved shift data is invalid.');
  const ids = new Set();
  const active = new Set();
  for (const shift of value) {
    if (!shift || typeof shift.id !== 'string' || ids.has(shift.id) ||
        typeof shift.employeeId !== 'string' || !/^[A-Z0-9_-]{1,32}$/.test(shift.employeeId) ||
        typeof shift.name !== 'string' || !shift.name.trim() || shift.name.length > 80 ||
        !Number.isSafeInteger(shift.start) || shift.start < 0 || shift.start > 8.64e15 ||
        !(shift.end === null || (Number.isSafeInteger(shift.end) && shift.end >= shift.start && shift.end <= 8.64e15))) {
      throw new Error('Saved shift data is invalid. Export or recover your browser data before continuing.');
    }
    ids.add(shift.id);
    if (shift.end === null) {
      if (active.has(shift.employeeId)) throw new Error('Multiple active shifts found for an employee.');
      active.add(shift.employeeId);
    }
  }
  return value;
}

export function recordShift(shifts, { employeeId, name, action, now, id }) {
  validateShifts(shifts);
  employeeId = normalizeId(employeeId);
  name = name.trim();
  if (!/^[A-Z0-9_-]{1,32}$/.test(employeeId)) throw new Error('Enter an employee ID using letters, numbers, hyphens or underscores.');
  if (!name || name.length > 80) throw new Error('Enter your name (up to 80 characters).');
  const active = shifts.find(shift => shift.employeeId === employeeId && shift.end === null);
  if (action === 'in') {
    if (active) throw new Error('You are already clocked in.');
    const latestEnd = Math.max(0, ...shifts.filter(shift => shift.employeeId === employeeId).map(shift => shift.end ?? shift.start));
    if (now < latestEnd) throw new Error('The device clock is earlier than your last shift. Check the device time.');
    return validateShifts([...shifts, { id, employeeId, name, start: now, end: null }]);
  }
  if (action !== 'out') throw new Error('Choose clock in or clock out.');
  if (!active) throw new Error('You are not clocked in yet.');
  if (now < active.start) throw new Error('The device clock is earlier than your clock-in time. Check the device time.');
  return validateShifts(shifts.map(shift => shift.id === active.id ? { ...shift, end: now } : shift));
}

export function perthBoundaries(now) {
  const local = new Date(now + OFFSET);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET;
  const week = today - ((local.getUTCDay() + 6) % 7) * DAY;
  return { today, week };
}

export function totalTime(shifts, since, until) {
  return shifts.reduce((total, shift) =>
    total + Math.max(0, Math.min(shift.end ?? until, until) - Math.max(shift.start, since)), 0);
}

export function duration(milliseconds) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function timestamp(value) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: PERTH_ZONE, year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(value);
}

export function toCsv(shifts, now) {
  const cell = value => {
    const text = String(value);
    // Prevent spreadsheet formula execution for user-entered names and IDs.
    return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const rows = [['Employee ID', 'Name', 'Clock in (AWST)', 'Clock out (AWST)', 'Duration (minutes)', 'Status']];
  for (const shift of shifts) {
    rows.push([shift.employeeId, shift.name, timestamp(shift.start),
      shift.end === null ? '' : timestamp(shift.end),
      Math.floor(Math.max(0, (shift.end ?? now) - shift.start) / 60_000),
      shift.end === null ? 'Active' : 'Complete']);
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
