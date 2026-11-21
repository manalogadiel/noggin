export default function NogFeedLoading() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="h-10 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="h-8 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,360px)] lg:items-start">
          <div className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-mint)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)]">
            <div className="h-6 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
            <div className="h-52 w-full rounded-[22px] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
              <div className="h-12 w-12 rounded-full bg-[var(--noggin-white)] motion-safe:animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-[28px] bg-[var(--noggin-white)] p-5 shadow-[0_12px_28px_var(--noggin-shadow)]">
              <div className="h-6 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
              <div className="h-4 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            </div>

            <div className="flex flex-col items-center gap-4 rounded-[28px] bg-[var(--noggin-white)] p-6 shadow-[0_14px_34px_var(--noggin-shadow)]">
              <div className="h-16 w-full rounded-[24px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
              <div className="h-40 w-40 rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
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
