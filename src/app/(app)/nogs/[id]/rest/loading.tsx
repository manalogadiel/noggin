export default function NogRestLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto grid w-full max-w-[1160px] grid-cols-1 items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:pr-16"
    >
      <div aria-hidden="true" className="flex flex-col items-start gap-6">
        <div className="h-24 w-64 rounded-[24px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse" />
        <div className="h-6 w-36 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sage)] motion-safe:animate-pulse" />
        <div className="h-12 w-full max-w-[340px] rounded-[18px] bg-[var(--noggin-white)] motion-safe:animate-pulse" />
        <div className="h-14 w-56 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-sage)] motion-safe:animate-pulse" />
      </div>

      <div
        aria-hidden="true"
        className="mx-auto h-72 w-full max-w-[480px] rounded-[32px] bg-[var(--noggin-mint-light)] motion-safe:animate-pulse"
      />
    </div>
  );
}
