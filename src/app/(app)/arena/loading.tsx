export default function ArenaLoading() {
  return (
    <div aria-busy="true" className="space-y-8 md:space-y-10">
      <div aria-hidden="true" className="space-y-3">
        <div className="h-11 w-48 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-5 w-80 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="h-56 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] motion-safe:animate-pulse md:h-64"
      />

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        <div className="h-56 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-56 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="h-80 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse"
      />
    </div>
  );
}
