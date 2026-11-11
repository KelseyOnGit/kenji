"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { registrationResponseSchema, registrationSchema } from "@/lib/contracts";
import { requestJson } from "@/lib/client-api";

export default function RegisterPage() {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const submitting = useRef(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = registrationSchema.safeParse({
      fullName: fields.get("fullName"),
      displayName: fields.get("displayName"),
      contactNumber: fields.get("contactNumber"),
      email: fields.get("email"),
      pin,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (pin !== confirmPin) {
      setError("The PINs do not match. Please enter the same four digits in both fields.");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      await requestJson("/api/register", registrationResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      form.reset();
      setComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed. Please try again.");
    } finally {
      setPin("");
      setConfirmPin("");
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <main className="registration-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-name">SSS<span>Parts</span></span><span className="brand-divider" /><span className="brand-product">Staff registration</span></div>
        <Link className="nav-link" href="/">Back to clock</Link>
      </header>
      <section className="registration-card" aria-labelledby="registration-title">
        <h1 id="registration-title">{complete ? "You're registered." : "Join the team clock."}</h1>
        {complete ? (
          <div role="status">
            <p className="registration-intro">Your profile is pending approval. Ask your manager to approve it before you clock in.</p>
            <p className="registration-intro">Use the same four-digit PIN once your profile is approved.</p>
            <Link className="primary-button button-link" href="/">Return to clock</Link>
          </div>
        ) : (
          <>
            <p className="registration-intro">Choose your own four-digit PIN.Your full name and PIN are required. </p>
            {error && <p className="error-notice" role="alert">{error}</p>}
            <form className="registration-form" onSubmit={register} aria-busy={pending}>
              <fieldset disabled={pending}>
                <label htmlFor="fullName">Full name <span>(required, need to match passport)</span></label>
                <input className="text-input" id="fullName" name="fullName" autoComplete="name" minLength={2} maxLength={120} required />
                <label htmlFor="displayName">Display name <span>(optional)</span></label>
                <input className="text-input" id="displayName" name="displayName" maxLength={120} aria-describedby="display-help" />
                <p id="display-help" className="field-help">The name shown in kiosk search. Leave blank to use your full name.</p>
                <div className="form-columns">
                  <div>
                    <label htmlFor="new-pin">4-digit PIN <span>(required)</span></label>
                    <input className="text-input" id="new-pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} required />
                  </div>
                  <div>
                    <label htmlFor="confirm-pin">Confirm PIN <span>(required)</span></label>
                    <input className="text-input" id="confirm-pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))} required />
                  </div>
                </div>
                <label htmlFor="contactNumber">Contact number <span>(optional)</span></label>
                <input className="text-input" id="contactNumber" name="contactNumber" type="tel" autoComplete="tel" maxLength={30} />
                <label htmlFor="email">Email <span>(optional)</span></label>
                <input className="text-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} />
                <p className="field-help">Your manager will set your employment type after registration.</p>
                <button className="primary-button" type="submit">{pending ? "Registering..." : "Register"}</button>
              </fieldset>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
