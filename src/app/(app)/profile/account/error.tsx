"use client";

export default function ProfileAccountError({
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  return (
    <section
      role="alert"
      className="flex flex-col items-center rounded-[28px] bg-[var(--noggin-cream)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-10"
    >
      <h2 className="noggin-display text-[1.5rem] font-extrabold text-[var(--noggin-forest)]">
        Brain fog 😵
      </h2>
      <p className="mt-1 text-[0.9375rem] text-[var(--noggin-ink)]">
        We couldn&apos;t load your account settings right now.
      </p>
      <button
        type="button"
        onClick={() => (reset ?? retry)?.()}
        className="noggin-primary-pill noggin-display mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center px-6 py-2.5 text-[1rem] font-bold"
      >
        Try again
      </button>
    </section>
  );
}
