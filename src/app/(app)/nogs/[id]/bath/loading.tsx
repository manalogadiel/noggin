export default function NogBathLoading() {
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2.5 rounded-[28px] bg-[var(--noggin-white)] p-4 shadow-[0_12px_28px_var(--noggin-shadow)]">
            <div className="h-5 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-14 w-full rounded-[18px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-14 w-full rounded-[18px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          </div>

          <div className="flex flex-col gap-5 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-8">
            <div className="h-10 w-56 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="h-36 rounded-[24px] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
              <div className="h-36 rounded-[24px] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden h-56 w-16 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse lg:block"
      />
    </div>
  );
}
