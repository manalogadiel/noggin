export default function CustomizeLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 py-2"
    >
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-11 w-28 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-12 w-80 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-6 w-48 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-10"
      >
        <div className="flex items-center justify-center rounded-[36px] bg-[var(--noggin-mint)] p-8">
          <div className="h-[260px] w-[260px] rounded-full bg-[var(--noggin-mint-light)] motion-safe:animate-pulse lg:h-[360px] lg:w-[360px]" />
        </div>

        <div className="flex flex-col gap-6 rounded-[36px] bg-[var(--noggin-mint)] p-6 sm:p-8 lg:rounded-[44px]">
          <div className="h-8 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
          <div className="flex gap-3.5">
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
          </div>
          <div className="h-8 w-40 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
          <div className="flex gap-3.5">
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
            <div className="h-16 w-16 rounded-[18px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
          </div>
          <div className="h-14 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
