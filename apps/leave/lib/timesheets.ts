const PERTH_OFFSET = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SHIFT_HOURS = 16;

export function toPerthLocal(date: Date): string {
  return new Date(date.getTime() + PERTH_OFFSET).toISOString().slice(0, 16);
}

export function perthLocalToDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid Perth date and time.");
  }
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || toPerthLocal(date) !== value) {
    throw new Error("Enter a valid Perth date and time.");
  }
  return date;
}

export function perthWeekStart(date: Date): Date {
  const local = new Date(date.getTime() + PERTH_OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - ((local.getUTCDay() + 6) % 7) * DAY_MS - PERTH_OFFSET);
}

export function parseWeekParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+08:00`);
    if (Number.isFinite(date.getTime()) && toPerthLocal(date).slice(0, 10) === value) return perthWeekStart(date);
  }
  return perthWeekStart(new Date());
}

export function addedShiftTimes(date: string, startTime: string, endTime: string) {
  const clockIn = perthLocalToDate(`${date}T${startTime}`);
  const end = perthLocalToDate(`${date}T${endTime}`);
  const clockOut = end <= clockIn ? new Date(end.getTime() + DAY_MS) : end;
  return { clockIn, clockOut };
}

export function shiftMinutes(clockIn: Date, clockOut: Date | null): number {
  return clockOut ? Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000)) : 0;
}

export function formatHours(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function missingClockOut(clockIn: Date, clockOut: Date | null, now: Date): boolean {
  return clockOut === null && now.getTime() - clockIn.getTime() >= MAX_SHIFT_HOURS * 3600000;
}

export function perthDisplay(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-AU", { ...options, timeZone: "Australia/Perth" }).format(date);
}
