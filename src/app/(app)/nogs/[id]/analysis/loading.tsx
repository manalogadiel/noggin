export default function NogAnalysisLoading() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-7"
    >
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-center lg:gap-7">
          <div className="flex flex-col items-center gap-4">
            <div className="h-[240px] w-[240px] rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse sm:h-[280px] sm:w-[280px]" />
            <div className="h-10 w-44 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-8 w-40 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
          </div>

          <div className="flex flex-col gap-3.5 rounded-[32px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7">
            <div className="h-24 w-full rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-24 w-full rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-24 w-full rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="mx-auto mt-1 h-4 w-56 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[32px] bg-[var(--noggin-cream)] p-5 shadow-[0_14px_34px_var(--noggin-shadow)] sm:p-7">
          <div className="h-8 w-52 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-32 w-full rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
            <div className="h-32 w-full rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
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
