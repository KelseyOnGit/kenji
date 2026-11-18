import { z } from "zod";
import { perthLocalToDate } from "./timesheets";

export const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  pin: z.string().regex(/^\d{4}$/, "Enter exactly four digits."),
}).strict();

export const successSchema = z.object({ ok: z.literal(true) });

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(72, "Password must be at most 72 characters."),
}).strict();

const recordId = z.string().min(1).max(128);
const reason = z.string().trim().min(3, "Give a reason of at least 3 characters.")
  .max(500, "Keep the reason to 500 characters.");
const perthDateTime = z.string().refine(value => {
  try { perthLocalToDate(value); return true; } catch { return false; }
}, "Enter a valid Perth date and time.");
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD.")
  .refine(value => perthDateTime.safeParse(`${value}T00:00`).success, "Enter a valid date.");
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:mm.");

export const timesheetClockOutSchema = z.object({
  shiftId: recordId, clockOut: perthDateTime, reason,
}).strict();
export const timesheetEditSchema = z.object({
  shiftId: recordId, clockIn: perthDateTime, clockOut: perthDateTime,
  expectedUpdatedAt: z.iso.datetime(), reason,
}).strict();
export const timesheetAddSchema = z.object({
  userId: recordId, date: localDate, startTime: localTime, endTime: localTime,
  reason, requestId: z.uuid(),
}).strict();
export const timesheetSuccessSchema = z.object({ ok: z.literal(true) });
