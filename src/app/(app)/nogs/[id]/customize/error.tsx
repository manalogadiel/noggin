"use client";

export default function CustomizeError({
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[680px] py-6">
      <section
        role="alert"
        className="flex flex-col items-center rounded-[var(--noggin-radius-card)] bg-[var(--noggin-white)] p-8 text-center shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-12"
      >
        <h1 className="noggin-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold text-[var(--noggin-forest)]">
          Brain fog 😵 — couldn&apos;t load customize.
        </h1>

        <button
          type="button"
          onClick={retry ?? reset}
          className="noggin-primary-pill noggin-display mt-6 inline-flex min-h-12 cursor-pointer items-center justify-center px-7 text-[1.0625rem] font-bold"
        >
          Try again
        </button>
      </section>
    </div>
  );
}
