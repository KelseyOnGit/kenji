"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { staffLoginSchema, successSchema } from "@leave/lib/contracts";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = staffLoginSchema.safeParse({ identifier: fields.get("identifier"), pin: fields.get("pin") });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    submitting.current = true;
    setPending(true);
    try {
      await requestJson("/api/auth/login", successSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed. Please try again.");
    } finally {
      const pinInput = form.elements.namedItem("pin");
      if (pinInput instanceof HTMLInputElement) pinInput.value = "";
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <main className="shell">
      <header className="topbar"><div className="brand">SSS <span>Auto Parts</span></div><span>Staff portal</span></header>
      <section className="card login-card">
        <p className="eyebrow"></p>
        <h1>Staff sign in.</h1>

        <p>Use your registered phone number or email and the same four-digit PIN you use at the clock.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <form method="post" onSubmit={login} aria-busy={pending}>
          <label htmlFor="identifier">Phone number or email</label>
          <input id="identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={pending} />
          <label htmlFor="pin">Four-digit PIN</label>
          <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required disabled={pending} />
          <button type="submit" className="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="login-switch">Administrator? <Link href="/admin/login">Admin sign in</Link></p>
      </section>
    </main>
  );
}
