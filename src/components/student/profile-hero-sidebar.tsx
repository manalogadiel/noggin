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
    <aside className="prof-hero-card">
      <div className="prof-hero-card__surface">
        <div className="prof-avatar-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/game/nog/head.png"
            alt=""
            width={138}
            height={138}
          />
        </div>

        <p className="prof-hero-name">{displayName}</p>
        <p className="m-0 text-[0.9375rem] font-semibold text-[var(--noggin-forest)]">
          Student
        </p>
        <span className="noggin-display inline-flex items-center justify-center rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-leaf-strong)] px-4 py-1 text-[0.875rem] font-bold text-[var(--noggin-white)]">
          Lvl. {level}
        </span>

        <div className="prof-xp-box">
          <div className="prof-xp-box__head">
            <span>XP Progress</span>
            <span className="tnum">
              {state.xp} / {state.xpMax} XP
            </span>
          </div>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        <div className="prof-mini-stats">
          <span className="tnum">🔥 {state.streakDays}d Streak</span>
          <span className="tnum">🪙 {state.coins}</span>
          <span className="tnum">
            🐾 {nogCount} {nogCount === 1 ? "Nog" : "Nogs"}
          </span>
          <span className="tnum">⭐ {mastered} Mastered</span>
        </div>

        <button
          type="button"
          onClick={() => openModal({ type: "plus" })}
          className={`prof-plus-hero-btn ${state.isPlus ? "is-active" : ""}`}
        >
          {state.isPlus ? "✨ Noggin Plus Active" : "Upgrade to Noggin Plus"}
        </button>
      </div>
    </aside>
  );
}
