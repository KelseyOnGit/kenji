import { describe, expect, it } from "vitest";
import { adminLoginSchema, staffLoginSchema } from "@leave/lib/contracts";

describe("phone-or-email login forms", () => {
  it("accepts phone and email while preserving PINs and passwords exactly", () => {
    expect(staffLoginSchema.parse({ identifier: " 0412 345 678 ", pin: "0123" })).toEqual({
      identifier: "0412 345 678", pin: "0123",
    });
    expect(adminLoginSchema.parse({ identifier: "admin@example.com", password: " 0012 " })).toEqual({
      identifier: "admin@example.com", password: " 0012 ",
    });
  });

  it("keeps older email clients working but rejects mixed identity and extra fields", () => {
    expect(staffLoginSchema.parse({ email: "staff@example.com", pin: "0123" })).toEqual({
      identifier: "staff@example.com", pin: "0123",
    });
    expect(adminLoginSchema.safeParse({ identifier: "0412345678", email: "admin@example.com", password: "test" }).success).toBe(false);
    expect(staffLoginSchema.safeParse({ email: "staff@example.com", pin: "0123", role: "ADMIN" }).success).toBe(false);
  });

  it("shows useful validation messages rather than a generic union error", () => {
    const invalidPhone = staffLoginSchema.safeParse({ identifier: "not a phone", pin: "0123" });
    expect(invalidPhone.error?.issues[0].message).toBe("Enter a valid phone number or email address.");
    const invalidPin = staffLoginSchema.safeParse({ identifier: "0412345678", pin: "123" });
    expect(invalidPin.error?.issues[0].message).toBe("Enter exactly four digits.");
    const noPassword = adminLoginSchema.safeParse({ identifier: "admin@example.com", password: "" });
    expect(noPassword.error?.issues[0].message).toBe("Enter your password.");
  });
});
