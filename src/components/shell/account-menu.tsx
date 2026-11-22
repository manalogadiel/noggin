"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";

export interface AccountMenuProps {
  displayName: string | null;
}

export function AccountMenu({ displayName }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const handledByBaseUiRef = useRef(false);

  const trimmedName = displayName?.trim() || null;
  const label = trimmedName ?? "Account";
  const triggerAriaLabel = trimmedName
    ? `Account menu for ${trimmedName}`
    : "Account menu";

  async function handleSignOut() {
    await signOutAction();
  }

  return (
    <Menu.Root
      open={open}
      onOpenChange={(nextOpen) => {
        handledByBaseUiRef.current = true;
        setOpen(nextOpen);
      }}
    >
      <Menu.Trigger
        aria-label={triggerAriaLabel}
        onPointerDown={() => {
          handledByBaseUiRef.current = false;
        }}
        onClick={() => {
          if (!handledByBaseUiRef.current) {
            setOpen((prev) => !prev);
          }
          handledByBaseUiRef.current = false;
        }}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--noggin-radius-pill)] py-1 pr-2.5 pl-1 text-[var(--noggin-forest)] transition-colors hover:bg-[color-mix(in_srgb,var(--noggin-white)_45%,transparent)]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--noggin-white)] shadow-[0_2px_8px_var(--noggin-shadow)]">
          <Image
            src="/nog/head.png"
            alt=""
            width={44}
            height={44}
            className="h-9 w-9 object-contain"
          />
        </span>
        <span className="noggin-display hidden text-[1.0625rem] font-bold leading-none text-[var(--noggin-forest)] min-[480px]:inline">
          {label}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[var(--noggin-forest)]"
          aria-hidden="true"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={10} align="end" className="z-50">
          <Menu.Popup className="min-w-[200px] rounded-[20px] bg-[var(--noggin-white)] p-2 shadow-[0_12px_32px_var(--noggin-shadow)] outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="noggin-display border-b border-[var(--noggin-mint)] px-3 py-2.5 text-[0.9375rem] font-bold text-[var(--noggin-forest)]">
                {label}
              </Menu.GroupLabel>
              <Menu.Item
                render={<Link href="/profile/progress" />}
                className="noggin-display mt-1 flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[0.9375rem] font-semibold text-[var(--noggin-forest)] transition-colors hover:bg-[var(--noggin-mint)] data-[highlighted]:bg-[var(--noggin-mint)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
              >
                <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Profile</span>
              </Menu.Item>
              <Menu.Item
                render={<Link href="/profile/account" />}
                className="noggin-display mt-0.5 flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[0.9375rem] font-semibold text-[var(--noggin-forest)] transition-colors hover:bg-[var(--noggin-mint)] data-[highlighted]:bg-[var(--noggin-mint)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Account settings</span>
              </Menu.Item>
              <form action={handleSignOut} role="none" className="mt-0.5">
                <Menu.Item
                  render={<button type="submit" />}
                  nativeButton
                  closeOnClick={false}
                  className="noggin-display flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[0.9375rem] font-semibold text-[var(--noggin-forest)] transition-colors hover:bg-[var(--noggin-mint)] data-[highlighted]:bg-[var(--noggin-mint)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--noggin-leaf)]"
                >
                  <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Log out</span>
                </Menu.Item>
              </form>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
