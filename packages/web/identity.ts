import { z } from "zod";

// Australian number after the country code: area/mobile digit 2, 3, 4, 7 or 8, then 8 digits.
const AU_NATIONAL = /^[2-478]\d{8}$/;
// Any E.164 number: "+", a non-zero first digit, 8 to 15 digits in total.
const E164 = /^\+[1-9]\d{7,14}$/;

const emailSchema = z.string().max(254).email();

/**
 * Turns a phone number typed in any common format into E.164, e.g. "+61412345678".
 * Returns null if it is not a valid number.
 * Keep these rules identical to the backfill SQL in the user_phone migration.
 */
export function normalizePhone(input: string): string | null {
  // Remove spaces, brackets, dots and hyphens
  const cleaned = input.trim().replace(/[\s().-]/g, "");
  // Only digits and one optional "+" at the very start are allowed
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const hasPlus = cleaned.startsWith("+");
  const digits = hasPlus ? cleaned.slice(1) : cleaned;

  // 0412 345 678 or 08 9123 4567 (Australian local format)
  if (!hasPlus && digits.startsWith("0")) {
    const national = digits.slice(1);
    return AU_NATIONAL.test(national) ? `+61${national}` : null;
  }

  if (digits.startsWith("61")) {
    let national = digits.slice(2);
    // "+61 0412 345 678": people often keep the 0 after +61
    if (national.startsWith("0")) national = national.slice(1);
    if (AU_NATIONAL.test(national)) return `+61${national}`;
    // Starts with 61 but isn't a valid Australian number: only accept it as
    // another country's number if the user typed the "+"
  }

  // Other countries must be typed with a "+", e.g. +44 20 7946 0958
  if (hasPlus && E164.test(`+${digits}`) && !digits.startsWith("61")) return `+${digits}`;

  return null;
}

export type LoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

/** Works out whether someone typed an email or a phone number on a login form. */
export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return emailSchema.safeParse(email).success ? { kind: "email", value: email } : null;
  }

  const phone = normalizePhone(trimmed);
  return phone ? { kind: "phone", value: phone } : null;
}

/** "+61412345678" -> "0412 345 678", "+61891234567" -> "(08) 9123 4567", others unchanged. */
export function formatPhoneForDisplay(e164: string): string {
  const match = /^\+61([2-478])(\d{8})$/.exec(e164);
  if (!match) return e164;
  const [, first, rest] = match;
  if (first === "4") {
    // Mobile: 04XX XXX XXX
    const local = `0${first}${rest}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  // Landline: (0X) XXXX XXXX
  return `(0${first}) ${rest.slice(0, 4)} ${rest.slice(4)}`;
}