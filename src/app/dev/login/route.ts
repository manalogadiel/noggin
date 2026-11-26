import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDevAutoLoginEnabled, resolveDevLoginOrigin } from "@/middleware";

const DEFAULT_REDIRECT = "/nogs";
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

function emptyNotFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function readSupabaseConfig(): { url: string; anonKey: string } | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return { url: rawUrl, anonKey };
  } catch {
    return null;
  }
}

function sanitizeNextPath(raw: string | null, origin: string): string {
  if (!raw || raw.length === 0) {
    return DEFAULT_REDIRECT;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return DEFAULT_REDIRECT;
  }

  for (const candidate of [raw, decoded]) {
    if (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.startsWith("/\\") ||
      candidate.includes("\\") ||
      CONTROL_CHAR_PATTERN.test(candidate)
    ) {
      return DEFAULT_REDIRECT;
    }

    try {
      const parsed = new URL(candidate, origin);
      if (
        parsed.origin !== origin ||
        !parsed.pathname.startsWith("/") ||
        parsed.pathname.startsWith("//")
      ) {
        return DEFAULT_REDIRECT;
      }
    } catch {
      return DEFAULT_REDIRECT;
    }
  }

  return raw;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDevAutoLoginEnabled(request)) {
    return emptyNotFound();
  }

  const email = process.env.DEV_LOGIN_EMAIL?.trim();
  const password = process.env.DEV_LOGIN_PASSWORD;
  if (!email || !password || password.trim().length === 0) {
    return emptyNotFound();
  }

  const supabaseConfig = readSupabaseConfig();
  if (!supabaseConfig) {
    return new NextResponse(null, { status: 500 });
  }

  const origin = resolveDevLoginOrigin(request);
  const nextPath = sanitizeNextPath(
    request.nextUrl.searchParams.get("next"),
    origin,
  );
  const redirectResponse = NextResponse.redirect(new URL(nextPath, origin));
  redirectResponse.headers.set("cache-control", "no-store");

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            redirectResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.user) {
      return new NextResponse(null, { status: 500 });
    }
  } catch {
    return new NextResponse(null, { status: 500 });
  }

  return redirectResponse;
}
