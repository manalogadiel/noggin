export default function AdoptLoading() {
  return (
    <div aria-busy="true" className="game-world game-world--hatch">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/game/bg/sanctuary-day.jpg"
        alt=""
        className="scene-bg-img scene-bg-img--sanctuary"
      />
      <div className="scene-bg-scrim scene-bg-scrim--hatch" aria-hidden="true" />

      <div className="stage-body items-center justify-center gap-6 text-center">
        <div
          aria-hidden="true"
          className="h-28 w-[340px] max-w-[90vw] rounded-[999px] bg-[var(--noggin-cream-translucent)] shadow-[var(--shadow-soft)] motion-safe:animate-pulse"
        />
        <div
          aria-hidden="true"
          className="h-64 w-56 rounded-[50%] bg-[var(--noggin-cream-translucent)] shadow-[var(--shadow-soft)] motion-safe:animate-pulse"
        />
      </div>
    </div>
  );
}
