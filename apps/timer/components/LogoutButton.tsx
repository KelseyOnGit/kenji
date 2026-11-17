"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { requestJson } from "@/lib/client-api";

const logoutResponseSchema = z.object({ ok: z.literal(true) });

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");

    try {
      await requestJson("/api/auth/logout", logoutResponseSchema, { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign out failed. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="rounded border border-current px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-1 text-sm">{error}</p>}
    </div>
  );
}
