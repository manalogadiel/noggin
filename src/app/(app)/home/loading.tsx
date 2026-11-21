export default function HomeLoading() {
  return (
    <div aria-busy="true" className="space-y-8 md:space-y-10">
      <div aria-hidden="true" className="space-y-3">
        <div className="h-11 w-56 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-5 w-72 max-w-full rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="h-64 rounded-[var(--noggin-radius-card)] bg-[var(--noggin-mint)] motion-safe:animate-pulse md:h-72"
      />

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="h-48 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-48 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-48 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
