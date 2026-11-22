export default function NogNotebookLoading() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-10 w-44 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="h-8 w-28 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,310px)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-3 rounded-[28px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)]">
            <div className="h-11 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          </div>

          <div className="flex flex-col gap-4 rounded-[28px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-9 w-52 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
              <div className="flex gap-2">
                <div className="h-11 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
                <div className="h-11 w-32 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
              </div>
            </div>

            <div className="h-24 w-full rounded-[22px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-24 w-full rounded-[22px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />

            <div className="mt-2 h-6 w-44 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="h-28 w-full rounded-[22px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
              <div className="h-28 w-full rounded-[22px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
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
