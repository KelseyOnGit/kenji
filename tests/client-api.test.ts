import { afterEach, describe, expect, it, vi } from "vitest";
import { newRequestId } from "../packages/web/client-api";

afterEach(() => vi.unstubAllGlobals());

describe("newRequestId", () => {
  it("uses randomUUID in secure contexts", () => {
    const randomUUID = vi.fn(() => "random-uuid");
    vi.stubGlobal("crypto", { randomUUID });

    expect(newRequestId()).toBe("random-uuid");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("generates a valid UUID on HTTP LAN origins without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });

    expect(newRequestId()).toBe("abababab-abab-4bab-abab-abababababab");
  });
});
