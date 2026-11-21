export default function ProfileProgressLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-3"
      >
        <div className="h-24 rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-24 rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-24 rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>
      <div
        aria-hidden="true"
        className="h-56 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse"
      />
    </div>
  );
}
