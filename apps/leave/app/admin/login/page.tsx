"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@kenji/web/client-api";
import { adminLoginSchema, successSchema } from "@leave/lib/contracts";

export default function AdminLoginPage() {
  const router = useRouter();
  const submitting = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = adminLoginSchema.safeParse({
      email: fields.get("email"),
      password: fields.get("password"),
    });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    submitting.current = true;
    setPending(true);
    try {
      await requestJson("/api/admin/auth/login", successSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed. Please try again.");
    } finally {
      const passwordInput = form.elements.namedItem("password");
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
      setShowPassword(false);
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">SSS <span>Auto Parts</span></div>
        <span>Admin portal</span>
      </header>
      <section className="card login-card">
        <p className="eyebrow">Admin access</p>
        <h1>Admin sign in.</h1>
        <p>Use your admin email and password.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <form onSubmit={login} aria-busy={pending}>
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254}
            autoCapitalize="none" spellCheck={false} disabled={pending} />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type={showPassword ? "text" : "password"}
            autoComplete="current-password" required maxLength={72} disabled={pending} />
          <button type="button" className="password-toggle" aria-controls="admin-password"
            aria-pressed={showPassword} disabled={pending} onClick={() => setShowPassword(value => !value)}>
            {showPassword ? "Hide password" : "Show password"}
          </button>
          <button type="submit" className="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="login-switch">Staff member? <Link href="/login">Go to staff sign in</Link></p>
      </section>
    </main>
  );
}
