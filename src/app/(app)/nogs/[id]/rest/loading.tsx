export default function NogRestLoading() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="h-8 w-28 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-5 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-10">
          <div className="h-10 w-44 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
          <div className="h-5 w-72 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
          <div className="h-56 w-full max-w-[560px] rounded-[32px] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
          <div className="h-12 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden h-56 w-16 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse lg:block"
      />
    </div>
  );
}
