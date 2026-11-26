"use client";

import {
  BookOpen,
  Egg,
  Gamepad2,
  Home,
  LogOut,
  Moon,
  Plus,
  Swords,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { GameModals } from "@/components/game-ui/game-modals";
import { RoomsOverlay } from "@/components/game-ui/rooms-overlay";
import { IntentLink } from "@/components/shell/intent-link";
import { TopBar } from "@/components/shell/top-bar";

export interface ShellFrameProps {
  displayName: string | null;
  showArena?: boolean;
  children: ReactNode;
}

const NOG_PATH_REGEX = /^\/nogs\/([^/]+)(?:\/|$)/;

export function extractNogId(pathname: string): string | null {
  const match = NOG_PATH_REGEX.exec(pathname);
  return match ? match[1] : null;
}

export function isFocusPath(pathname: string): boolean {
  if (pathname === "/adopt" || pathname.startsWith("/adopt/")) {
    return true;
  }
  return extractNogId(pathname) !== null;
}

export function ShellFrame({
  displayName,
  showArena = true,
  children,
}: ShellFrameProps) {
  const pathname = usePathname() ?? "/home";
  const [navPendingFrom, setNavPendingFrom] = useState<string | null>(null);
  const [drawerState, setDrawerState] = useState<{ open: boolean; path: string }>({
    open: false,
    path: pathname,
  });
  const drawerOpen = drawerState.open && drawerState.path === pathname;
  const setDrawerOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    setDrawerState((prev) => {
      const curOpen = prev.open && prev.path === pathname;
      const val = typeof next === "function" ? next(curOpen) : next;
      return { open: val, path: pathname };
    });
  };
  const drawerId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const nogId = extractNogId(pathname);
  const studyBase = nogId ? `/nogs/${nogId}` : "/nogs";
  const isNavigating = navPendingFrom === pathname;

  useEffect(() => {
    let showTimer: number | null = null;
    let clearTimer: number | null = null;
    const onDocClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || !rawHref.startsWith("/") || rawHref.startsWith("//")) return;
      const nextPath = rawHref.split(/[?#]/)[0];
      if (nextPath === pathname) return;
      if (showTimer !== null) window.clearTimeout(showTimer);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
      showTimer = window.setTimeout(() => {
        setNavPendingFrom(pathname);
      }, 90);
      clearTimer = window.setTimeout(() => {
        setNavPendingFrom(null);
      }, 8000);
    };
    document.addEventListener("click", onDocClick, true);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      if (showTimer !== null) window.clearTimeout(showTimer);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
    };
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerState({ open: false, path: pathname });
        menuButtonRef.current?.focus();
      }
    };
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        drawerRef.current &&
        !drawerRef.current.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setDrawerState({ open: false, path: pathname });
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [drawerOpen, pathname]);

  const primaryLinks = [
    { href: "/home", label: "Home", icon: Home, active: pathname === "/home" || /^\/nogs\/[^/]+$/.test(pathname) },
    { href: "/nogs", label: "Choose Your Nog", icon: Egg, active: pathname === "/nogs" },
    ...(showArena ? [{ href: "/arena", label: "Arena", icon: Swords, active: pathname.startsWith("/arena") }] : []),
    { href: "/profile/progress", label: "Profile & Shop", icon: User, active: pathname.startsWith("/profile") },
  ];

  const studyLinks = [
    { href: nogId ? `${studyBase}/play` : "/nogs", label: "Play", icon: Gamepad2, active: pathname.includes("/play") },
    { href: nogId ? `${studyBase}/rest` : "/nogs", label: "Nap", icon: Moon, active: pathname.includes("/rest") },
    { href: nogId ? `${studyBase}/notebook` : "/nogs", label: "Notebooks", icon: BookOpen, active: pathname.includes("/notebook") },
  ];

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col">
      {isNavigating && <div className="route-progress-bar" aria-hidden="true" />}
      <TopBar
        displayName={displayName}
        drawerOpen={drawerOpen}
        drawerId={drawerId}
        menuButtonRef={menuButtonRef}
        onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
      />

      {drawerOpen && (
        <>
          <div
            className="nav-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            id={drawerId}
            className="nav-drawer"
            aria-label="App navigation"
          >
            <div className="game-sidebar__brand">
              <span className="wordmark" style={{ fontSize: 28 }}>
                Noggin
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="figma-menu-btn"
              >
                <X className="h-[22px] w-[22px]" strokeWidth={2.6} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="App" className="game-sidebar__nav">
              {primaryLinks.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <IntentLink
                    key={item.href}
                    ref={idx === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={item.active ? "page" : undefined}
                    className="gs-nav-btn"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </IntentLink>
                );
              })}

              <span className="nav-drawer__group-label">Study &amp; Care</span>

              {studyLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <IntentLink
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={item.active ? "page" : undefined}
                    className="gs-nav-btn"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </IntentLink>
                );
              })}
            </nav>

            <div className="game-sidebar__footer">
              <Link
                href="/adopt"
                onClick={() => setDrawerOpen(false)}
                className="gbtn gbtn--white"
                style={{ width: "100%" }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
                <span>Hatch a Nog</span>
              </Link>
              <form action={async () => { await signOutAction(); }}>
                <button
                  type="submit"
                  className="gs-wallet-btn justify-center"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Log out</span>
                  </span>
                </button>
              </form>
            </div>
          </aside>
        </>
      )}

      <main id="main" className="app-shell-main flex min-w-0 flex-1 flex-col">
        {children}
      </main>

      <RoomsOverlay />
      <GameModals />
    </div>
  );
}
