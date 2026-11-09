import { STORAGE_KEY, PERTH_ZONE, normalizeId, validateShifts, recordShift, perthBoundaries, totalTime, duration, timestamp, toCsv } from './time-clock.js';

const $ = id => document.getElementById(id);
let shifts = [];
let storageError = false;
let saving = false;
const clockFormat = new Intl.DateTimeFormat('en-AU', { timeZone: PERTH_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dateFormat = new Intl.DateTimeFormat('en-AU', { timeZone: PERTH_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

function readShifts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? [] : validateShifts(JSON.parse(saved));
}

function refresh() {
  try {
    shifts = readShifts();
    storageError = false;
  } catch {
    storageError = true;
    message('Browser storage is unavailable or contains invalid data. Records have not been overwritten. Restore valid data or use a browser with local storage enabled.', true);
  }
  renderHistory();
  render();
}

function render() {
  const now = Date.now();
  $('clock').textContent = clockFormat.format(now);
  $('date').textContent = dateFormat.format(now);
  const employeeId = normalizeId($('employee-id').value);
  const own = shifts.filter(shift => shift.employeeId === employeeId);
  const active = own.find(shift => shift.end === null);
  $('shift-status').textContent = active ? `Clocked in since ${timestamp(active.start)}` :
    employeeId ? 'Off the clock. Ready when you are.' : 'Enter your employee ID to get started.';
  $('clock-in').disabled = storageError || saving || !employeeId || Boolean(active);
  $('clock-out').disabled = storageError || saving || !active;
  $('export').disabled = storageError || shifts.length === 0;
  $('current-total').textContent = duration(active ? now - active.start : 0);
  $('current-detail').textContent = active ? 'Shift in progress' : 'Not clocked in';
  const { today, week } = perthBoundaries(now);
  $('today-total').textContent = duration(totalTime(own, today, now));
  $('week-total').textContent = duration(totalTime(own, week, now));
}

function renderHistory() {
  const body = $('history-body');
  body.replaceChildren();
  $('empty-history').hidden = shifts.length > 0;
  for (const shift of [...shifts].sort((a, b) => b.start - a.start)) {
    const row = document.createElement('tr');
    const person = document.createElement('td');
    person.textContent = shift.employeeId;
    row.append(person);
    for (const text of [timestamp(shift.start), shift.end === null ? '—' : timestamp(shift.end), duration((shift.end ?? Date.now()) - shift.start)]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = shift.end === null ? 'badge' : 'badge complete';
    badge.textContent = shift.end === null ? 'On the clock' : 'Complete';
    status.append(badge);
    row.append(status);
    body.append(row);
  }
}

$('employee-id').addEventListener('input', () => {
  message('');
  render();
});

$('clock-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || storageError) return;
  const action = event.submitter?.value ?? 'in';
  const employeeId = $('employee-id').value;
  saving = true;
  render();
  try {
    if (!navigator.locks) throw new Error('Use a modern browser over HTTPS (or localhost) to safely save shifts.');
    await navigator.locks.request(STORAGE_KEY, () => {
      const next = recordShift(readShifts(), { employeeId, action, now: Date.now(), id: crypto.randomUUID() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      shifts = next;
    });
    message(action === 'in' ? 'You’re clocked in. Have a great shift!' : 'You’re clocked out. Thanks for your work today!');
  } catch (error) {
    message(error.message || 'Unable to save your shift. Please try again.', true);
  } finally {
    saving = false;
    renderHistory();
    render();
  }
});

$('export').addEventListener('click', () => {
  refresh();
  if (storageError || !shifts.length) return;
  const url = URL.createObjectURL(new Blob([toCsv(shifts, Date.now())], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kenji-shifts.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('Shift export downloaded. Keep this file somewhere safe.');
});

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) refresh();
});
refresh();
setInterval(render, 1000);
setInterval(renderHistory, 60_000);
