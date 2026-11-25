import Link from "next/link";

export interface PublicHeaderAction {
  label: string;
  href: string;
}

export interface PublicHeaderProps {
  active?: "home" | "discover";
  action?: PublicHeaderAction;
}

const DEFAULT_ACTION: PublicHeaderAction = {
  label: "Log in",
  href: "/login",
};

const NAV_TABS = [
  { key: "home", label: "Home", href: "/" },
  { key: "discover", label: "Discover", href: "/discover" },
] as const;

export function PublicHeader({
  active,
  action = DEFAULT_ACTION,
}: PublicHeaderProps) {
  const showNav = active === "home" || active === "discover";

  return (
    <header className="pub-header">
      <div className="pub-header__left">
        <Link href="/" className="wordmark" aria-label="Noggin home">
          Noggin
        </Link>
      </div>

      <div className="pub-header__center">
        {showNav && (
          <nav className="pub-nav-pill" aria-label="Main navigation">
            {NAV_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active === tab.key ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="pub-header__right">
        <Link href={action.href} className="pub-cta-pill">
          {action.label}
        </Link>
      </div>
    </header>
  );
}
