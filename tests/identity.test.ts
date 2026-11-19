import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, normalizePhone, parseLoginIdentifier } from "@kenji/web/identity";

const examples: [string, string | null][] = [
  ["0412 345 678", "+61412345678"],
  ["(08) 9123-4567", "+61891234567"],
  ["61412345678", "+61412345678"],
  ["+61 (0) 412.345.678", "+61412345678"],
  ["+44 20 7946 0958", "+442079460958"],
  ["442079460958", null],
  ["+614123", null],
  ["0412345678 ext 1", null],
  ["abc0412345678", null],
  ["0412/345678", null],
  ["++61412345678", null],
  ["+6141234567890123", null],
  ["", null],
];
const migration = () => readFile(new URL("../packages/database/prisma/migrations/20261118023409_user_phone/migration.sql", import.meta.url), "utf8");

describe("phone and email identifiers", () => {
  it.each(examples)("normalizes %s safely", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("recognizes case-insensitive email and normalized phone identifiers", () => {
    expect(parseLoginIdentifier(" TEST@EXAMPLE.COM ")).toEqual({ kind: "email", value: "test@example.com" });
    expect(parseLoginIdentifier("0412 345 678")).toEqual({ kind: "phone", value: "+61412345678" });
    expect(parseLoginIdentifier("wrong@example")).toBeNull();
    expect(parseLoginIdentifier("")).toBeNull();
    expect(formatPhoneForDisplay("+61412345678")).toBe("0412 345 678");
    expect(formatPhoneForDisplay("+61891234567")).toBe("(08) 9123 4567");
    expect(formatPhoneForDisplay("+442079460958")).toBe("+442079460958");
  });

  it("backfills the same phone formats as login without changing contact numbers", async () => {
    const db = await PGlite.create();
    try {
      await db.exec('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "contactNumber" TEXT)');
      // Separate equivalent formats into individual runs to preserve uniqueness.
      for (const [input, expected] of examples) {
        await db.query('INSERT INTO "User" VALUES ($1, $2)', ["one", input]);
        await db.exec(await migration());
        const result = await db.query('SELECT "contactNumber", "phone" FROM "User"');
        expect(result.rows).toEqual([{ contactNumber: input, phone: expected }]);
        await db.exec('ALTER TABLE "User" DROP COLUMN "phone"; DELETE FROM "User"');
      }
    } finally {
      await db.close();
    }
  }, 30000);

  it("rejects duplicate backfilled phones atomically instead of choosing an account", async () => {
    const db = await PGlite.create();
    try {
      await db.exec('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "contactNumber" TEXT)');
      await db.query('INSERT INTO "User" VALUES ($1, $2), ($3, $4)', ["one", "0412345678", "two", "+61412345678"]);
      await expect(db.exec(await migration())).rejects.toThrow();
      await db.exec("ROLLBACK");
      const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'phone'");
      expect(columns.rows).toEqual([]);
      expect((await db.query('SELECT count(*)::int AS count FROM "User"')).rows).toEqual([{ count: 2 }]);
    } finally {
      await db.close();
    }
  }, 30000);
});
