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
import { RoomsOverlay } from "@/components/game-ui/rooms-overlay";
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
            className="ng-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            id={drawerId}
            className="ng-drawer"
            aria-label="App navigation"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <span
                className="text-2xl font-black tracking-tight text-white"
                style={{ fontFamily: "var(--noggin-font-display), sans-serif" }}
              >
                Noggin
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="App" className="flex flex-1 flex-col gap-1">
              {primaryLinks.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    ref={idx === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`ng-drawer__link ${item.active ? "is-active" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <span className="px-4 pt-4 pb-1 text-[11px] font-black tracking-widest text-[var(--ng-c-e2f7c5)] uppercase">
                Study &amp; Care
              </span>

              {studyLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`ng-drawer__link ${item.active ? "is-active" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
              <Link
                href="/adopt"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[var(--ng-c-2f5406)] shadow-[0_4px_0_rgba(40,70,10,0.22)]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
                <span>Hatch a Nog</span>
              </Link>
              <form action={async () => { await signOutAction(); }}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white/90 hover:bg-white/15"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Log out</span>
                </button>
              </form>
            </div>
          </aside>
        </>
      )}

      <main id="main" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>

      <RoomsOverlay />
    </div>
  );
}
