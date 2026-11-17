import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  requestJson: vi.fn(),
  deleteSession: vi.fn(),
  setPending: vi.fn(),
  setError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/client-api", () => ({ requestJson: mocks.requestJson }));
vi.mock("@/lib/session", () => ({ deleteSession: mocks.deleteSession }));
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: (initial: boolean | string) =>
      [initial, typeof initial === "boolean" ? mocks.setPending : mocks.setError],
    useRef: () => ({ current: false }),
  };
});

import LogoutButton from "@/components/LogoutButton";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

function clickLogout() {
  const root = LogoutButton() as ReactElement<{ children: [ReactElement<{ onClick: () => Promise<void> }>, unknown] }>;
  return root.props.children[0].props.onClick();
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("admin logout", () => {
  it("deletes the session before returning success", async () => {
    const response = await logoutRoute();
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("redirects to login after the logout request succeeds", async () => {
    mocks.requestJson.mockResolvedValue({ ok: true });
    await clickLogout();
    expect(mocks.requestJson).toHaveBeenCalledWith(
      "/api/auth/logout", expect.anything(), { method: "POST" },
    );
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.setPending.mock.calls).toEqual([[true], [false]]);
  });

  it("shows a failure without navigating when logout fails", async () => {
    mocks.requestJson.mockRejectedValue(new Error("Connection lost."));
    await clickLogout();
    expect(mocks.setError).toHaveBeenLastCalledWith("Connection lost.");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.setPending).toHaveBeenLastCalledWith(false);
  });
});
