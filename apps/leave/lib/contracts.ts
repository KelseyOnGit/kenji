import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  pin: z.string().regex(/^\d{4}$/, "Enter exactly four digits."),
}).strict();

export const successSchema = z.object({ ok: z.literal(true) });
