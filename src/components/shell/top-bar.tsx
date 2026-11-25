"use client";

import { ChevronLeft, LayoutGrid, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, RefObject } from "react";
import { useGameUi } from "@/components/game-ui/game-ui-context";

export interface TopBarProps {
  displayName: string | null;
  focusMode?: boolean;
  leading?: ReactNode;
  onToggleDrawer?: () => void;
  drawerOpen?: boolean;
  drawerId?: string;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
}

function resolvePageTitle(pathname: string, isRoomsOpen: boolean): { title: string; isHome: boolean } {
  if (isRoomsOpen) return { title: "Rooms", isHome: false };
  if (pathname === "/home" || /^\/nogs\/[^/]+$/.test(pathname)) return { title: "", isHome: true };
  if (pathname === "/nogs") return { title: "Choose Your Nog", isHome: false };
  if (pathname.startsWith("/adopt")) return { title: "Hatch a Nog", isHome: false };
  if (pathname.includes("/customize")) return { title: "Customize", isHome: false };
  if (pathname.includes("/play")) return { title: "Play", isHome: false };
  if (pathname.includes("/rest")) return { title: "Rest", isHome: false };
  if (pathname.includes("/notebook")) return { title: "Notebooks", isHome: false };
  if (pathname.includes("/analysis")) return { title: "Brain Map", isHome: false };
  if (pathname.includes("/feed")) return { title: "Teach", isHome: false };
  if (pathname.includes("/water")) return { title: "Water", isHome: false };
  if (pathname.includes("/bath")) return { title: "Bath", isHome: false };
  if (pathname.startsWith("/arena")) return { title: "Party Arena", isHome: false };
  if (pathname.startsWith("/profile")) return { title: "Profile & Shop", isHome: false };
  return { title: "", isHome: false };
}

export function TopBar({
  displayName,
  onToggleDrawer,
  drawerOpen = false,
  drawerId,
  menuButtonRef,
}: TopBarProps) {
  const pathname = usePathname() ?? "/home";
  const { state, modal, openModal, closeModal } = useGameUi();
  const isRoomsOpen = modal?.type === "rooms";
  const { title, isHome } = resolvePageTitle(pathname, isRoomsOpen);
  const userName = displayName?.trim() || "Student";
  const xpPct = Math.min(100, Math.round((state.xp / Math.max(1, state.xpMax)) * 100));

  return (
    <header className="ng-topbar">
      <div className="ng-topbar__left">
        <button
          ref={menuButtonRef}
          type="button"
          className="ng-menu-btn"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          onClick={onToggleDrawer}
        >
          <Menu className="h-5 w-5" strokeWidth={2.7} aria-hidden="true" />
        </button>

        {isRoomsOpen ? (
          <button
            type="button"
            className="ng-yellow-3d"
            onClick={() => closeModal()}
            aria-label="Back to Home"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            <span>Home</span>
          </button>
        ) : isHome ? (
          <Link href="/nogs" className="ng-yellow-3d">
            <LayoutGrid className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            <span>Switch Nog</span>
          </Link>
        ) : (
          <Link href="/home" className="ng-yellow-3d" aria-label="Back to Home">
            <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            <span>Home</span>
          </Link>
        )}

        {title ? <span className="ng-topbar__title">{title}</span> : null}
      </div>

      <div className="ng-topbar__right">
        <Link
          href="/profile/shop"
          className="ng-shop-btn"
          title="Open Shop"
          aria-label="Open Shop"
          onClick={() => {
            if (isRoomsOpen) closeModal();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M4 6h4.2l2.6 12.2c.3 1.3 1.4 2.2 2.7 2.2h10.8c1.2 0 2.3-.8 2.6-2l2.2-8.4H9.6" fill="var(--ng-c-ffe678)" />
            <path d="M4 6h4.2l1.2 5.6h19.7l-1.2 4.6H11.5" fill="var(--ng-c-fff6c4)" opacity="0.5" />
            <circle cx="13.5" cy="25.5" r="3" fill="var(--ng-c-4a2e00)" />
            <circle cx="13.5" cy="25.5" r="1.2" fill="var(--ng-c-ffe678)" />
            <circle cx="24" cy="25.5" r="3" fill="var(--ng-c-4a2e00)" />
            <circle cx="24" cy="25.5" r="1.2" fill="var(--ng-c-ffe678)" />
            <path d="M3 5.5h5.2l.8 3.2" stroke="var(--ng-c-4a2e00)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </Link>

        <button
          type="button"
          className="ng-currency-pill"
          onClick={() => openModal({ type: "topup" })}
          aria-label={`${state.coins} coins — tap to buy more`}
        >
          <svg width="24" height="24" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" fill="var(--ng-c-f7cb52)" />
            <circle cx="18" cy="18" r="12.5" fill="var(--ng-c-ffe184)" />
            <path d="M18 10c2.8 0 5 1.8 5 4.4 0 3.2-3.4 3.8-5 5.4-1.6-1.6-5-2.2-5-5.4C13 11.8 15.2 10 18 10z" fill="var(--ng-c-d99416)" />
            <circle cx="18" cy="23.5" r="2.2" fill="var(--ng-c-d99416)" />
          </svg>
          <span>{state.coins}</span>
          <span className="ng-coin-plus" aria-hidden="true">+</span>
        </button>

        <button
          type="button"
          className="ng-currency-pill"
          onClick={() => openModal({ type: "streak" })}
          aria-label={`${state.streakDays} day streak`}
        >
          <svg width="24" height="24" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" fill="var(--ng-c-f3827a)" />
            <path d="M18.5 8.5c2.2 3.8 5.5 5.6 5.5 10.2a6 6 0 1 1-12 0c0-2.6 1.2-4.8 2.8-6.4.2 1.8 1.2 2.8 2.2 3.1-.4-2.8.1-5.1 1.5-6.9z" fill="var(--ng-c-fff3c4)" />
          </svg>
          <span>{state.streakDays}d</span>
        </button>

        <Link
          href="/profile/progress"
          className="ng-acc-pill"
          aria-label={`${userName} — Level ${state.level}, ${state.xp} / ${state.xpMax} EXP`}
          onClick={() => {
            if (isRoomsOpen) closeModal();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nog/head.png" alt="" className="ng-acc-pill__avatar" />
          <div className="ng-acc-meta">
            <div className="ng-acc-row">
              <span className="ng-acc-name">{userName}</span>
              <span className="ng-acc-lv">Lv.{state.level}</span>
            </div>
            <div className="ng-acc-xp" title={`${state.xp} / ${state.xpMax} EXP`}>
              <span style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
