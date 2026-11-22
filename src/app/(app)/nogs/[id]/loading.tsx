export default function NogRoomLoading() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-8"
    >
      <div
        aria-hidden="true"
        className="flex flex-col items-center gap-6"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="h-12 w-56 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
          <div className="h-11 w-11 rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        </div>

        <div className="h-[280px] w-[280px] rounded-full bg-[var(--noggin-mint)] motion-safe:animate-pulse lg:h-[420px] lg:w-[420px]" />

        <div className="h-14 w-full max-w-[360px] rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="flex flex-col gap-3.5 rounded-[36px] bg-[var(--noggin-mint)] p-6 lg:rounded-[50px]"
      >
        <div className="h-32 w-full rounded-[28px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-16 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-16 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-16 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-16 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-16 w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
