"use client";

import { useGameUi } from "@/components/game-ui/game-ui-context";

export interface ProfileHeroSidebarProps {
  displayName: string;
  level: number;
  nogCount: number;
  mastered: number;
}

export function ProfileHeroSidebar({
  displayName,
  level,
  nogCount,
  mastered,
}: ProfileHeroSidebarProps) {
  const { state, openModal } = useGameUi();
  const xpPct = Math.max(
    4,
    Math.min(100, Math.round((state.xp / Math.max(1, state.xpMax)) * 100)),
  );

  return (
    <aside className="ng-prof-hero-card">
      <div className="ng-prof-hero-card__surface">
        <div className="ng-prof-avatar-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/game/nog/head.png"
            alt=""
            width={120}
            height={120}
          />
        </div>

        <p className="noggin-display mt-1 text-[1.5rem] font-extrabold text-[var(--noggin-forest)]">
          {displayName}
        </p>
        <p className="text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
          Student
        </p>
        <span className="noggin-display inline-flex items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-4 py-1.5 text-[0.9375rem] font-bold text-[var(--noggin-white)]">
          Lvl. {level}
        </span>

        <div className="ng-prof-xp-box">
          <div className="flex items-center justify-between text-[12px] font-bold text-[var(--noggin-forest)]">
            <span>XP Progress</span>
            <span className="tabular-nums">
              {state.xp} / {state.xpMax} XP
            </span>
          </div>
          <div className="ng-prof-xp-track" aria-hidden="true">
            <div className="ng-prof-xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        <div className="ng-prof-mini-stats">
          <span className="ng-prof-mini-stat tabular-nums">
            🔥 {state.streakDays}d Streak
          </span>
          <span className="ng-prof-mini-stat tabular-nums">
            🪙 {state.coins}
          </span>
          <span className="ng-prof-mini-stat tabular-nums">
            🐾 {nogCount} {nogCount === 1 ? "Nog" : "Nogs"}
          </span>
          <span className="ng-prof-mini-stat tabular-nums">
            ⭐ {mastered} Mastered
          </span>
        </div>

        <button
          type="button"
          onClick={() => openModal({ type: "plus" })}
          className={`ng-prof-plus-hero-btn ${state.isPlus ? "is-active" : ""}`}
        >
          {state.isPlus ? "✨ Noggin Plus Active" : "Upgrade to Noggin Plus"}
        </button>
      </div>
    </aside>
  );
}
