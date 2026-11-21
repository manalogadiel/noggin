export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/nogs", label: "My Nogs", icon: "egg" },
] as const;

export const PRIMARY_ACTION = {
  href: "/adopt",
  label: "Hatch a Nog",
} as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
