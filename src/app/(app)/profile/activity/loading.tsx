export default function ProfileActivityLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="h-44 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse"
      />
      <div
        aria-hidden="true"
        className="h-32 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse"
      />
    </div>
  );
}
