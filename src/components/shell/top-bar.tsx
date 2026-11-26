"use client";

import { ChevronLeft, LayoutGrid, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, type RefObject, useState } from "react";
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
  const { state, modal, sanctuary, openModal, closeModal, updateState, awardRewards, showToast } =
    useGameUi();
  const [tasksOpen, setTasksOpen] = useState(false);

  const isRoomsOpen = modal?.type === "rooms";
  const { title, isHome } = resolvePageTitle(pathname, isRoomsOpen);
  const userName = displayName?.trim() || "Student";
  const xpPct = Math.min(100, Math.round((state.xp / Math.max(1, state.xpMax)) * 100));

  const nogIdFromPath = /^\/nogs\/([^/]+)$/.exec(pathname)?.[1] ?? null;
  const activeNogId = sanctuary?.nogId ?? nogIdFromPath;
  const activeNogName = sanctuary?.nogName ?? "your Nog";
  const roomBaseHref = activeNogId ? `/nogs/${activeNogId}` : "/nogs";

  const dailyTasks = [
    {
      id: "t-feed",
      label: "Teach 1 thought",
      coins: 25,
      xp: 40,
      icon: "✏️",
      done: Boolean(sanctuary?.teachDone),
      href: activeNogId ? `${roomBaseHref}/feed` : "/adopt",
    },
    {
      id: "t-water",
      label: "Water 1 memory",
      coins: 0,
      xp: 50,
      icon: "💧",
      done: Boolean(sanctuary?.waterDone),
      href: activeNogId ? `${roomBaseHref}/water` : "/adopt",
    },
    {
      id: "t-pet",
      label: `Pet ${activeNogName} once`,
      coins: 10,
      xp: 15,
      icon: "💚",
      done: Boolean(sanctuary?.petDone),
      href: null as string | null,
    },
  ];
  const tasksLeft = dailyTasks.filter((t) => !state.claimedTasks[t.id]).length;

  function handleClaimTask(task: (typeof dailyTasks)[number]) {
    if (state.claimedTasks[task.id]) return;
    if (!task.done) {
      setTasksOpen(false);
      showToast(`Tap ${activeNogName} to pet them!`);
      return;
    }
    updateState((prev) => ({
      ...prev,
      claimedTasks: { ...prev.claimedTasks, [task.id]: true },
    }));
    awardRewards(task.coins, task.xp);
    const msgParts = [
      task.coins ? `+${task.coins} coins` : "",
      task.xp ? `+${task.xp} EXP` : "",
    ].filter(Boolean);
    showToast(`Claimed ${msgParts.join(" · ")}!`);
  }

  return (
    <header className="figma-app-topbar">
      <div className="topbar-left">
        <button
          ref={menuButtonRef}
          type="button"
          className="figma-menu-btn"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          onClick={onToggleDrawer}
        >
          <Menu className="h-[22px] w-[22px]" strokeWidth={2.8} aria-hidden="true" />
        </button>

        {isRoomsOpen ? (
          <button
            type="button"
            className="topbar-yellow-3d"
            onClick={() => closeModal()}
            aria-label="Back to Home"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            <span>Home</span>
          </button>
        ) : isHome ? (
          <>
            <Link href="/nogs" prefetch={true} className="topbar-yellow-3d">
              <LayoutGrid className="h-[15px] w-[15px]" strokeWidth={2.6} aria-hidden="true" />
              <span>Switch Nog</span>
            </Link>

            {sanctuary && (
              <div className="tasks-chest-anchor">
                <button
                  type="button"
                  className="tasks-chest-btn"
                  aria-expanded={tasksOpen}
                  aria-label={`Daily Tasks (${tasksLeft} available)`}
                  title="Daily Tasks"
                  onClick={() => setTasksOpen((v) => !v)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/game/ui/icon-chest-clay.svg"
                    alt=""
                    className="tasks-chest-btn__img"
                  />
                  {tasksLeft > 0 && (
                    <span className="tasks-chest-badge tnum">{tasksLeft}</span>
                  )}
                </button>

                {tasksOpen && (
                  <div className="tasks-popover" role="dialog" aria-label="Daily Tasks">
                    <div className="tasks-popover__surface">
                      <div className="tasks-popover__head">
                        <div className="tasks-popover__title">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/game/ui/icon-chest-clay.svg"
                            alt=""
                            className="tasks-popover__crest"
                          />
                          <div>
                            <strong>Daily Tasks</strong>
                            <span className="tnum">{tasksLeft} left today</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="tasks-close-btn"
                          onClick={() => setTasksOpen(false)}
                          aria-label="Close tasks"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="tasks-popover__list">
                        {dailyTasks.map((t) => {
                          const isClaimed = Boolean(state.claimedTasks[t.id]);
                          const rewardText = [
                            t.coins ? `+${t.coins} coins` : "",
                            t.xp ? `+${t.xp} EXP` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <div
                              key={t.id}
                              className={`tasks-row ${isClaimed ? "is-claimed" : ""}`}
                            >
                              <span className="tasks-row__ico" aria-hidden="true">
                                {t.icon}
                              </span>
                              <div className="tasks-row__info">
                                <strong>{t.label}</strong>
                                <span className="tnum">{rewardText}</span>
                              </div>
                              {!isClaimed && !t.done && t.href ? (
                                <Link
                                  href={t.href}
                                  onClick={() => setTasksOpen(false)}
                                  className="tasks-row__btn"
                                >
                                  Go
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isClaimed}
                                  onClick={() => handleClaimTask(t)}
                                  className={`tasks-row__btn ${
                                    isClaimed ? "is-done" : t.done ? "is-claim" : ""
                                  }`}
                                >
                                  {isClaimed ? "Done ✓" : t.done ? "Claim" : "Go"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <Link href="/home" prefetch={true} className="topbar-yellow-3d" aria-label="Back to Home">
            <ChevronLeft className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            <span>Home</span>
          </Link>
        )}

        {title ? <span className="topbar-ctx-title">{title}</span> : null}
      </div>

      <div className="topbar-right">
        <Link
          href="/profile/shop"
          prefetch={true}
          className="topbar-shop-btn"
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
          className="cs-currency-pill topbar-currency-pill topbar-coin-pill tnum"
          onClick={() => openModal({ type: "topup" })}
          title="Top Up Coins"
          aria-label={`${state.coins} coins — tap to buy more`}
        >
          <span className="cs-currency-pill__icon">
            <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="16" fill="var(--ng-c-f7cb52)" />
              <circle cx="18" cy="18" r="12.5" fill="var(--ng-c-ffe184)" />
              <path d="M18 10c2.8 0 5 1.8 5 4.4 0 3.2-3.4 3.8-5 5.4-1.6-1.6-5-2.2-5-5.4C13 11.8 15.2 10 18 10z" fill="var(--ng-c-d99416)" />
              <circle cx="18" cy="23.5" r="2.2" fill="var(--ng-c-d99416)" />
            </svg>
          </span>
          <span>{state.coins}</span>
          <span className="topbar-coin-plus" aria-hidden="true">+</span>
        </button>

        <button
          type="button"
          className="cs-currency-pill topbar-currency-pill tnum"
          onClick={() => openModal({ type: "streak" })}
          aria-label={`${state.streakDays} day streak`}
        >
          <span className="cs-currency-pill__icon">
            <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="16" fill="var(--ng-c-f3827a)" />
              <path d="M18.5 8.5c2.2 3.8 5.5 5.6 5.5 10.2a6 6 0 1 1-12 0c0-2.6 1.2-4.8 2.8-6.4.2 1.8 1.2 2.8 2.2 3.1-.4-2.8.1-5.1 1.5-6.9z" fill="var(--ng-c-fff3c4)" />
            </svg>
          </span>
          <span>{state.streakDays}d</span>
        </button>

        <Link
          href="/profile/progress"
          prefetch={true}
          className="figma-account-btn figma-account-btn--xp"
          aria-label={`${userName} — Level ${state.level}, ${state.xp} / ${state.xpMax} EXP`}
          onClick={() => {
            if (isRoomsOpen) closeModal();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/game/nog/head.png" alt="" />
          <div className="topbar-acc-meta">
            <div className="topbar-acc-row">
              <span className="topbar-acc-name">{userName}</span>
              <span className="topbar-acc-lv tnum">Lv.{state.level}</span>
            </div>
            <div className="topbar-acc-xp" title={`${state.xp} / ${state.xpMax} EXP`}>
              <i style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
