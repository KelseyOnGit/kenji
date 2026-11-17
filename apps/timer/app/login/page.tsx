"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Admin sign in</h1>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <label className="block">
          Email
          <input type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading}
            className="block w-full border rounded px-3 py-2" />
        </label>
        <label className="block">
          Password
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading}
            className="block w-full border rounded px-3 py-2" />
        </label>
        <button disabled={loading} className="w-full rounded bg-orange-600 text-white py-2 disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}