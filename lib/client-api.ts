import { z } from "zod";
import { errorResponseSchema } from "./contracts";

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
  if (!parsed.success) throw new RequestError(502, "The server returned an unexpected response. Please contact your manager.");
  return parsed.data;
}
