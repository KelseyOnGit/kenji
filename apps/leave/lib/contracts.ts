import { z } from "zod";
import { perthLocalToDate } from "./timesheets";
import { parseLoginIdentifier } from "@kenji/web/identity";
import { leaveInterval, validLeaveDate } from "./leave";
import { normalizePhone } from "@kenji/web/identity";

const loginIdentifier = z.string().trim().max(254)
  .refine(value => parseLoginIdentifier(value) !== null, "Enter a valid phone number or email address.");
const pin = z.string().regex(/^\d{4}$/, "Enter exactly four digits.");
const password = z.string().min(1, "Enter your password.").max(72, "Password must be at most 72 characters.");
function legacyEmailLogin(input: unknown) {
  if (typeof input === "object" && input !== null && "email" in input && !("identifier" in input)) {
    const { email, ...fields } = input;
    return { ...fields, identifier: email };
  }
  return input;
}

export const staffLoginSchema = z.preprocess(legacyEmailLogin, z.object({
  identifier: loginIdentifier, pin,
}).strict());

export const successSchema = z.object({ ok: z.literal(true) });

export const adminLoginSchema = z.preprocess(legacyEmailLogin, z.object({
  identifier: loginIdentifier, password,
}).strict());

const recordId = z.string().min(1).max(128);
const reason = z.string().trim().max(500, "Keep the note to 500 characters.").default("");
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

const leaveDate = z.string().refine(validLeaveDate, "Enter a valid date between 2000 and 2199.");
const optionalTime = z.union([z.literal(""), localTime]);
const leaveFields = {
  type: z.enum(["ANNUAL", "PERSONAL", "UNPAID", "OTHER"]),
  allDay: z.boolean(),
  startDate: leaveDate, endDate: leaveDate,
  startTime: optionalTime, endTime: optionalTime,
  returnDate: leaveDate, returnTime: optionalTime,
  reason: z.string().trim().min(3, "Enter a reason of at least 3 characters.").max(1000, "Keep the reason to 1,000 characters."),
};
const leaveDetailsSchema = z.object(leaveFields).superRefine((input, ctx) => {
  const issue = (message: string, field: keyof typeof leaveFields) =>
    ctx.addIssue({ code: "custom", message, path: [field] });
  if (input.endDate < input.startDate) issue("The end date must be on or after the start date.", "endDate");
  if (!input.allDay && (input.startDate !== input.endDate || !input.startTime || !input.endTime)) {
    issue("Partial-day leave needs one date and both start and end times.", "startTime");
  }
  if (input.allDay && (input.startTime || input.endTime)) issue("Whole-day leave must not include start or end times.", "startTime");
  if (!input.allDay && !input.returnTime) issue("Enter your expected return time for partial-day leave.", "returnTime");
  if (ctx.issues.length) return;
  const { startsAt, endsAt } = leaveInterval(input);
  if (endsAt <= startsAt) issue("The end time must be after the start time on the same day.", "endTime");
  if (perthLocalToDate(`${input.returnDate}T${input.returnTime || "00:00"}`) < endsAt) {
    issue("Your expected return must be on or after the end of your leave.", "returnDate");
  }
});

export const leaveCreateSchema = leaveDetailsSchema.safeExtend({ requestId: z.uuid() }).strict();
export const leaveEditSchema = leaveDetailsSchema.safeExtend({
  leaveId: recordId, expectedVersion: z.number().int().positive(),
}).strict();
export const leaveCancelSchema = z.object({
  leaveId: recordId, expectedVersion: z.number().int().positive(),
}).strict();
export const leaveReviewSchema = leaveCancelSchema.extend({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000, "Keep your note to 1,000 characters."),
}).strict();

export const approveStaffSchema = z.object({
  userId: z.string().min(1).max(128),
}).strict();

// Admin: edit a staff member's details
const personName = z.string().trim().min(2, "Enter at least two characters.").max(120, "Use no more than 120 characters.")
  .regex(/^[^\u0000-\u001f\u007f]+$/, "Names cannot contain control characters.")
  .transform(value => value.replace(/\s+/g, " "));
const blankToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;
export const updateStaffSchema = z.object({
  userId: z.string().min(1).max(128),
  expectedUpdatedAt: z.iso.datetime(),
  legalName: personName,
  displayName: personName,
  phone: z.preprocess(blankToNull, z.string().trim().max(30)
    .refine(value => normalizePhone(value) !== null, "Enter a valid phone number, e.g. 0412 345 678 or +64 21 123 4567.").nullable()),
  email: z.preprocess(blankToNull, z.string().trim().toLowerCase().max(254).email("Enter a valid email address.").nullable()),
  employmentType: z.enum(["FULL_TIME", "CASUAL"], "Choose full-time or casual."),
}).strict().refine(value => value.phone !== null || value.email !== null, {
  message: "Keep at least a phone number or an email, so they can sign in to the staff portal.", path: ["phone"],
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;