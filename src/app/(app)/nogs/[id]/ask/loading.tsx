export default function NogAskLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-[920px] flex-col gap-5 px-5 py-8">
      <div className="h-10 w-48 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      <div className="h-72 w-full rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
    </div>
  );
}
