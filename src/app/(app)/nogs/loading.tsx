export default function NogsLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8">
      <div className="h-10 w-56 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-52 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-52 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
        <div className="h-52 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
