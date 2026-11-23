const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicHoliday = { date: string; name: string };

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function firstMonday(year: number, month: number) {
  const date = utcDate(year, month, 1);
  return addDays(date, (8 - date.getUTCDay()) % 7);
}

function lastMonday(year: number, month: number) {
  const date = utcDate(year, month + 1, 0);
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

function observedAfterWeekend(date: Date) {
  if (date.getUTCDay() === 6) return addDays(date, 2);
  if (date.getUTCDay() === 0) return addDays(date, 1);
  return null;
}

export function waPublicHolidays(year: number): PublicHoliday[] {
  const holidays = new Map<string, string[]>();
  const add = (date: Date, name: string) => {
    const key = dateKey(date);
    const names = holidays.get(key) ?? [];
    holidays.set(key, [...names, name]);
  };
  const addWithObserved = (date: Date, name: string) => {
    add(date, name);
    const observed = observedAfterWeekend(date);
    if (observed) add(observed, `${name} (additional day)`);
  };

  addWithObserved(utcDate(year, 1, 1), "New Year's Day");
  addWithObserved(utcDate(year, 1, 26), "Australia Day");
  add(firstMonday(year, 3), "Labour Day");

  const easter = easterSunday(year);
  add(addDays(easter, -2), "Good Friday");
  add(easter, "Easter Sunday");
  add(addDays(easter, 1), "Easter Monday");

  addWithObserved(utcDate(year, 4, 25), "Anzac Day");
  add(firstMonday(year, 6), "Western Australia Day");
  add(lastMonday(year, 9), "King's Birthday");

  const christmas = utcDate(year, 12, 25);
  const boxing = utcDate(year, 12, 26);
  add(christmas, "Christmas Day");
  add(boxing, "Boxing Day");
  const observedChristmas = observedAfterWeekend(christmas);
  let observedBoxing = observedAfterWeekend(boxing);
  if (observedChristmas && observedBoxing && dateKey(observedChristmas) === dateKey(observedBoxing)) {
    observedBoxing = addDays(observedBoxing, 1);
  }
  if (observedChristmas) add(observedChristmas, "Christmas Day (additional day)");
  if (observedBoxing) add(observedBoxing, "Boxing Day (additional day)");

  return [...holidays].map(([date, names]) => ({ date, name: names.join(" / ") })).sort((a, b) => a.date.localeCompare(b.date));
}

export function waPublicHoliday(date: string) {
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year)) return undefined;
  return waPublicHolidays(year).find(holiday => holiday.date === date);
}
