"use client";

import Link, { type LinkProps } from "next/link";
import { type AnchorHTMLAttributes, forwardRef, useState } from "react";

export type IntentLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

/**
 * Prefetches the full dynamic route payload on hover, focus, or pointer-down
 * without eagerly fetching every link on initial page render.
 */
export const IntentLink = forwardRef<HTMLAnchorElement, IntentLinkProps>(
  function IntentLink(
    { prefetch, onMouseEnter, onFocus, onPointerDown, ...rest },
    ref,
  ) {
    const [intent, setIntent] = useState(false);

    return (
      <Link
        ref={ref}
        prefetch={prefetch ?? (intent ? true : undefined)}
        onMouseEnter={(event) => {
          setIntent(true);
          onMouseEnter?.(event);
        }}
        onFocus={(event) => {
          setIntent(true);
          onFocus?.(event);
        }}
        onPointerDown={(event) => {
          setIntent(true);
          onPointerDown?.(event);
        }}
        {...rest}
      />
    );
  },
);
