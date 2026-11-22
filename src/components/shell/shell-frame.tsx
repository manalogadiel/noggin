"use client";

import {
  BookOpen,
  Egg,
  Home,
  Menu,
  Palette,
  Plus,
  Settings,
  Sprout,
  Swords,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { isNavItemActive, PRIMARY_ACTION } from "@/components/shell/nav-items";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { cn } from "@/lib/utils";

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

interface FocusMenuProps {
  showArena: boolean;
  nogId: string | null;
  pathname: string;
}

function FocusMenu({ showArena, nogId, pathname }: FocusMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    firstLinkRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("click", handleOutsidePointer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("click", handleOutsidePointer);
    };
  }, [open]);

  const primaryLinks = [
    { href: "/home", label: "Home", icon: Home, exact: false },
    { href: "/nogs", label: "My Nogs", icon: Egg, exact: true },
    ...(showArena
      ? [{ href: "/arena", label: "Arena", icon: Swords, exact: false }]
      : []),
    { href: "/profile/progress", label: "Profile", icon: User, exact: false },
  ];

  const nogBaseHref = nogId ? `/nogs/${nogId}` : null;
  const nogLinks = nogBaseHref
    ? [
        { href: nogBaseHref, label: "Room", icon: Home, exact: true },
        {
          href: `${nogBaseHref}/notebook`,
          label: "Notebook",
          icon: BookOpen,
          exact: false,
        },
        {
          href: `${nogBaseHref}/analysis`,
          label: "Analysis",
          icon: Sprout,
          exact: false,
        },
        {
          href: `${nogBaseHref}/customize`,
          label: "Customize",
          icon: Palette,
          exact: false,
        },
        {
          href: "/profile/account",
          label: "Settings",
          icon: Settings,
          exact: false,
        },
      ]
    : [];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--noggin-leaf-strong)] text-[var(--noggin-white)] shadow-[0_6px_16px_var(--noggin-shadow),inset_0_-2px_8px_var(--noggin-shadow-inset)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--noggin-forest)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-[calc(100%+12px)] left-0 z-50 w-64 rounded-[28px] bg-[var(--noggin-leaf-strong)] p-3 text-[var(--noggin-white)] shadow-[0_18px_40px_var(--noggin-shadow-strong),inset_0_-2px_12px_var(--noggin-shadow-inset)]"
      >
        {open ? (
          <nav aria-label="Menu" className="flex flex-col gap-1.5">
            {primaryLinks.map((item, index) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : isNavItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  ref={index === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "noggin-display flex min-h-11 items-center gap-3 rounded-[var(--noggin-radius-pill)] px-4 py-2 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-cream)]",
                    active
                      ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]"
                      : "text-[var(--noggin-white)] hover:bg-[color-mix(in_srgb,var(--noggin-white)_14%,transparent)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {nogLinks.length > 0 ? (
              <div className="mt-2 border-t border-[color-mix(in_srgb,var(--noggin-white)_20%,transparent)] pt-2.5">
                <p className="noggin-display px-4 pb-1.5 text-[0.75rem] font-bold tracking-wider text-[var(--noggin-mint-light)] uppercase">
                  This Nog
                </p>
                <div className="flex flex-col gap-1">
                  {nogLinks.map((item) => {
                    const Icon = item.icon;
                    const active = item.exact
                      ? pathname === item.href
                      : isNavItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "noggin-display flex min-h-11 items-center gap-3 rounded-[var(--noggin-radius-pill)] px-4 py-2 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-cream)]",
                          active
                            ? "bg-[var(--noggin-cream)] text-[var(--noggin-forest)] shadow-[0_4px_12px_var(--noggin-shadow)]"
                            : "text-[var(--noggin-white)] hover:bg-[color-mix(in_srgb,var(--noggin-white)_14%,transparent)]",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Link
              href={PRIMARY_ACTION.href}
              onClick={() => setOpen(false)}
              className="noggin-display mt-2 flex min-h-11 items-center justify-center gap-2 rounded-[var(--noggin-radius-pill)] bg-[var(--noggin-mint-light)] px-4 py-2.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)] shadow-[0_6px_14px_var(--noggin-shadow)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-cream)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{PRIMARY_ACTION.label}</span>
            </Link>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export function ShellFrame({
  displayName,
  showArena = false,
  children,
}: ShellFrameProps) {
  const pathname = usePathname() ?? "";
  const focusMode = isFocusPath(pathname);
  const nogId = extractNogId(pathname);

  if (focusMode) {
    return (
      <div className="flex min-h-[100dvh] min-w-0 flex-col">
        <TopBar
          displayName={displayName}
          focusMode
          leading={
            <FocusMenu
              showArena={showArena}
              nogId={nogId}
              pathname={pathname}
            />
          }
        />

        <main
          id="main"
          className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 md:px-12 md:py-8"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <Sidebar showArena={showArena} />

      <div className="flex min-w-0 flex-col">
        <TopBar displayName={displayName} />

        <main
          id="main"
          className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>

      <BottomBar showArena={showArena} />
    </div>
  );
}
