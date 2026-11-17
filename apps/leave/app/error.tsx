"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="shell"><section className="card"><h1>Unable to load the staff portal.</h1><p role="alert">Please try again. If this continues, contact us.</p><button type="button" onClick={reset}>Try again</button></section></main>;
}
