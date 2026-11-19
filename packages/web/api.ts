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
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const additionalOrigins = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestOrigin = new URL(request.url).origin;
  let originUrl: URL | null = null;
  if (origin) {
    try {
      originUrl = new URL(origin);
    } catch {
      throw new ApiError(403, "Use this site's form to submit your request.");
    }
  }
  const requestProtocol = new URL(requestOrigin).protocol.slice(0, -1);
  const matchesRequestOrigin = origin === requestOrigin && (host === null || originUrl?.host === host);
  const matchesHost = host !== null && origin === `${forwardedProtocol ?? requestProtocol}://${host}`;
  const matchesForwardedHost = forwardedHost !== undefined
    && originUrl?.host === forwardedHost
    && originUrl.protocol.slice(0, -1) === (forwardedProtocol ?? originUrl.protocol.slice(0, -1));
  const matchesConfiguredOrigin = origin !== null && additionalOrigins.includes(origin);
  if (origin && !matchesRequestOrigin && !matchesHost && !matchesForwardedHost && !matchesConfiguredOrigin) {
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
