import { z } from "zod";

const name = z.string().trim().min(2, "Enter at least two characters.")
  .max(120, "Use no more than 120 characters.")
  .regex(/^[^\u0000-\u001f\u007f]+$/, "Names cannot contain control characters.")
  .transform((value) => value.replace(/\s+/g, " "));
const optionalText = (schema: z.ZodString) =>
  z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, schema.optional());

export const pinSchema = z.string().regex(/^\d{4}$/, "Enter exactly four digits.");
export const registrationSchema = z.object({
  fullName: name,
  displayName: z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, name.optional()),
  pin: pinSchema,
  contactNumber: optionalText(z.string().trim().min(6).max(30).regex(/^[+\d\s().-]+$/, "Enter a valid contact number.")),
  email: optionalText(z.string().trim().toLowerCase().max(254).email("Enter a valid email address.")),
}).strict();

export const staffSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  currentShift: z.object({ id: z.string(), clockIn: z.iso.datetime() }).nullable(),
});
export const staffResponseSchema = z.object({
  staff: z.array(staffSchema),
  hasMore: z.boolean(),
});
export const punchSchema = z.object({
  userId: z.string().min(1).max(128),
  pin: pinSchema,
  action: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  expectedShiftId: z.string().min(1).max(128).nullable(),
  requestId: z.uuid(),
}).strict().refine(
  (value) => value.action === "CLOCK_IN" ? value.expectedShiftId === null : value.expectedShiftId !== null,
  "Clock-out needs the current shift; clock-in must not include one.",
);
export const punchResponseSchema = z.object({
  action: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  displayName: z.string(),
  occurredAt: z.iso.datetime(),
});
export const registrationResponseSchema = z.object({ status: z.literal("PENDING") });
export const errorResponseSchema = z.object({ error: z.string() });
export type Staff = z.infer<typeof staffSchema>;
export type PunchInput = z.infer<typeof punchSchema>;
