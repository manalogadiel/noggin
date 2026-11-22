export default function ProfileAccountLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div
        aria-hidden="true"
        className="h-96 rounded-[36px] bg-[var(--noggin-mint)] motion-safe:animate-pulse"
      />
    </div>
  );
}
