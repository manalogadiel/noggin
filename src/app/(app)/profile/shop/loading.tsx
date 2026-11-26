export default function ProfileShopLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div aria-hidden="true" className="h-24 rounded-[24px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-56 rounded-[28px] bg-[var(--noggin-mint)] motion-safe:animate-pulse" />
    </div>
  );
}
