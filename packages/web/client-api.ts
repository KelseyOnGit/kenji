import { z } from "zod";
const errorResponseSchema = z.object({ error: z.string() });

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requestJson<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new RequestError(0, "Connection lost. Please check the internet connection and try again.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RequestError(response.status, "The server returned an unreadable response. Please try again.");
  }
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new RequestError(response.status, parsed.success ? parsed.data.error : "The request failed. Please try again.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new RequestError(502, "The server returned an unexpected response. Please contact us.");
  return parsed.data;
}

/**
 * A random v4 UUID for request IDs. Uses crypto.randomUUID() when the page is HTTPS
 * or localhost, and builds the same format from crypto.getRandomValues() otherwise
 * (e.g. testing on http://192.168.x.x).
 */
export function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("This browser cannot generate a secure request ID. Please use a current browser.");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}