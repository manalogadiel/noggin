import Link from "next/link";

export interface PublicFooterProps {
  compact?: boolean;
}

export function PublicFooter({ compact = false }: PublicFooterProps) {
  return (
    <footer
      className={
        compact
          ? "relative z-20 mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-3 text-[0.875rem] font-semibold text-[var(--noggin-forest)]"
          : "discover-footer flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-[0.9375rem] font-semibold text-[var(--noggin-forest)]"
      }
    >
      <span>@Noggin</span>
      <Link
        href="/pricing"
        className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
      >
        Pricing
      </Link>
      <Link
        href="/terms"
        className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
      >
        Terms
      </Link>
      <Link
        href="/refund"
        className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
      >
        Refunds
      </Link>
      <Link
        href="/privacy"
        className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
      >
        Privacy
      </Link>
      <a
        href="mailto:gadielmanalo19@gmail.com"
        className="underline decoration-2 underline-offset-4 transition-opacity hover:opacity-80"
      >
        Support
      </a>
    </footer>
  );
}
