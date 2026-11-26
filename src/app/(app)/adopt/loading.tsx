export default function AdoptLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-[780px] flex-col items-center gap-6 px-5 py-10">
      <div className="h-10 w-64 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      <div className="h-72 w-full rounded-[32px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
    </div>
  );
}
