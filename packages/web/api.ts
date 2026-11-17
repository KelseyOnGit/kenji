import { Prisma } from "@prisma/client";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const additionalOrigins = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const matchesHost = host !== null && (origin === `http://${host}` || origin === `https://${host}`);
  const matchesRequestOrigin = origin === new URL(request.url).origin && (host === null || matchesHost);
  const matchesConfiguredOrigin = matchesHost && additionalOrigins.includes(origin ?? "");
  if (origin && !matchesRequestOrigin && !matchesConfiguredOrigin) {
    throw new ApiError(403, "Use this site's form to submit your request.");
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "Send an application/json request.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        throw new ApiError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) throw new ApiError(400, "Send valid JSON.");
    throw error;
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, result.error.issues[0].message);
  return result.data;
}

export function apiError(error: unknown, operation: string): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  // Do not log request bodies or raw Prisma errors: they can include PINs or profile data.
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  console.error(`${operation} failed`, {
    name: error instanceof Error ? error.name : "UnknownError",
    code,
  });
  return Response.json(
    { error: "The service is unavailable. Please try again or contact us." },
    { status: 503 },
  );
}
