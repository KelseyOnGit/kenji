"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { successSchema } from "@leave/lib/contracts";


export default function LogoutButton({ admin = false }: { admin?: boolean } = {}) {
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
      await requestJson(admin ? "/api/admin/auth/logout" : "/api/auth/logout", successSchema, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      router.replace(admin ? "/admin/login" : "/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign out failed. Please try again.");
    } finally { setPending(false); submitting.current = false; }
  }
  return <div><button type="button" onClick={logout} disabled={pending}>{pending ? "Signing out..." : "Sign out"}</button>{error && <p className="error" role="alert">{error}</p>}</div>;
}
