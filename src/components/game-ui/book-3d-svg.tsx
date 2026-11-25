import type { BookCoverStyle } from "@/components/game-ui/game-ui-context";

const STYLES: Record<
  BookCoverStyle,
  { c1: string; c2: string; c3: string; sp: string; bk: string; rib: string; ink: string; dark?: boolean; hasPat?: boolean }
> = {
  sage: { c1: "var(--ng-c-b2dc76)", c2: "var(--ng-c-87b64c)", c3: "var(--ng-c-5c8a28)", sp: "var(--ng-c-4e781e)", bk: "var(--ng-c-416818)", rib: "var(--ng-c-ea6c68)", ink: "var(--noggin-forest)" },
  honey: { c1: "var(--ng-c-ffe28c)", c2: "var(--ng-c-f2bf42)", c3: "var(--ng-c-cf8f15)", sp: "var(--ng-c-bc7a0b)", bk: "var(--ng-c-9c6206)", rib: "var(--ng-c-7aa941)", ink: "var(--ng-c-6b4400)", hasPat: true },
  gingham: { c1: "var(--ng-c-bce389)", c2: "var(--ng-c-a4d168)", c3: "var(--ng-c-82b04b)", sp: "var(--ng-c-6b9834)", bk: "var(--ng-c-557d24)", rib: "var(--ng-c-f2bd32)", ink: "var(--noggin-forest)", hasPat: true },
  berry: { c1: "var(--ng-c-ffa9a3)", c2: "var(--ng-c-eb7874)", c3: "var(--ng-c-c74f4f)", sp: "var(--ng-c-b23c3e)", bk: "var(--ng-c-942b2e)", rib: "var(--noggin-leaf)", ink: "var(--ng-c-8f2d30)", hasPat: true },
  denim: { c1: "var(--ng-c-a8d8f7)", c2: "var(--ng-c-75b2de)", c3: "var(--ng-c-4d85b5)", sp: "var(--ng-c-3f729e)", bk: "var(--ng-c-315b82)", rib: "var(--ng-c-f5c23b)", ink: "var(--ng-c-29567d)", hasPat: true },
  forest: { c1: "var(--ng-c-4e7a25)", c2: "var(--ng-c-355b14)", c3: "var(--ng-c-203a09)", sp: "var(--ng-c-193006)", bk: "var(--ng-c-112204)", rib: "var(--ng-c-f7cb52)", ink: "var(--ng-c-ffe694)", dark: true },
};

export function Book3dSvg({
  style = "sage",
  title,
  uid,
  className = "h-full w-full",
}: {
  style?: BookCoverStyle;
  title: string;
  uid: string;
  className?: string;
}) {
  const st = STYLES[style] ?? STYLES.sage;
  const raw = (title || "Notes").trim();
  const shortTitle = raw.length > 11 ? `${raw.slice(0, 10)}…` : raw;

  return (
    <svg viewBox="0 0 180 226" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`g-${uid}`} x1="22" y1="14" x2="156" y2="188" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={st.c1} />
          <stop offset="55%" stopColor={st.c2} />
          <stop offset="100%" stopColor={st.c3} />
        </linearGradient>
        <linearGradient id={`pg-${uid}`} x1="32" y1="176" x2="32" y2="206" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--ng-c-f3e5c5)" />
          <stop offset="45%" stopColor="var(--ng-c-fff9eb)" />
          <stop offset="100%" stopColor="var(--ng-c-ead7b0)" />
        </linearGradient>
        {style === "honey" && (
          <pattern id={`p-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 4h8M4 0v8" stroke="var(--noggin-white)" strokeOpacity=".22" strokeWidth="1.2" />
          </pattern>
        )}
        {style === "gingham" && (
          <pattern id={`p-${uid}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="var(--ng-c-b7df82)" />
            <rect width="12" height="24" fill="var(--noggin-white)" fillOpacity=".24" />
            <rect width="24" height="12" fill="var(--noggin-white)" fillOpacity=".24" />
          </pattern>
        )}
        {style === "berry" && (
          <pattern id={`p-${uid}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="3" fill="var(--ng-c-fff8f0)" fillOpacity=".35" />
          </pattern>
        )}
        {style === "denim" && (
          <pattern id={`p-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="var(--noggin-white)" strokeOpacity=".22" strokeWidth="2" />
          </pattern>
        )}
      </defs>
      <rect x="20" y="28" width="144" height="180" rx="20" fill={st.bk} />
      <path d="M36 172h118a8 8 0 0 1 8 8v12a10 10 0 0 1-10 10H38a14 14 0 0 1-14-14v-2a14 14 0 0 1 12-14z" fill={`url(#pg-${uid})`} />
      <path d="M42 186h112M42 192h112M42 197h108" stroke="var(--ng-c-dec99d)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M118 192h17v27l-8.5-6.5L118 219v-27z" fill={st.rib} />
      <rect x="20" y="12" width="144" height="170" rx="20" fill={`url(#g-${uid})`} />
      {st.hasPat && <rect x="20" y="12" width="144" height="170" rx="20" fill={`url(#p-${uid})`} />}
      <path d="M20 32a20 20 0 0 1 20-20h12v196H40a20 20 0 0 1-20-20V32z" fill={st.sp} />
      <path d="M52 12v170" stroke="var(--ng-c-000)" strokeOpacity=".1" strokeWidth="2" />
      <path d="M55 12v170" stroke="var(--ng-c-fff)" strokeOpacity=".22" strokeWidth="1.5" />
      <path d="M62 20h84" stroke="var(--ng-c-fff)" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      {st.dark ? (
        <>
          <rect x="60" y="26" width="92" height="142" rx="14" stroke="var(--ng-c-f7cb52)" strokeWidth="2.2" opacity=".76" />
          <text x="106" y="100" textAnchor="middle" fill="var(--ng-c-ffe694)" fontSize="12.5" fontWeight="800" fontFamily="Poppins,sans-serif">
            {shortTitle}
          </text>
        </>
      ) : (
        <>
          <rect x="64" y="52" width="84" height="52" rx="14" fill="var(--ng-c-fffdf6)" />
          <text x="106" y="83" textAnchor="middle" fill={st.ink} fontSize="12" fontWeight="800" fontFamily="Poppins,sans-serif">
            {shortTitle}
          </text>
        </>
      )}
    </svg>
  );
}
