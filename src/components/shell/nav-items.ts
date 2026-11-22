export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/nogs", label: "My Nogs", icon: "egg" },
] as const;

export const ARENA_ITEM = {
  href: "/arena",
  label: "Arena",
  icon: "swords",
} as const;

export const PRIMARY_ACTION = {
  href: "/adopt",
  label: "Hatch a Nog",
} as const;

export type NavItem = (typeof NAV_ITEMS)[number] | typeof ARENA_ITEM;

export function navItemsFor(options?: {
  showArena?: boolean;
}): ReadonlyArray<NavItem> {
  return options?.showArena ? [...NAV_ITEMS, ARENA_ITEM] : NAV_ITEMS;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
