import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/home", "/nogs", "/adopt", "/settings"] as const;
const DEV_LOGIN_PATH = "/dev/login";
const ALLOWED_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isDevLoginPath(pathname: string): boolean {
  return pathname === DEV_LOGIN_PATH || pathname.startsWith(`${DEV_LOGIN_PATH}/`);
}

function isLoopbackHostname(hostname: string): boolean {
  return ALLOWED_LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function parseHostHeader(raw: string): { hostname: string; host: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || /[\s/\\@?#]/.test(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(`http://${trimmed}`);
    if (
      parsed.pathname !== "/" ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0 ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      return null;
    }
    return { hostname: parsed.hostname.toLowerCase(), host: parsed.host };
  } catch {
    return null;
  }
}

function readRequestUrl(request: NextRequest): URL | null {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
}

export function isDevAutoLoginEnabled(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  if (process.env.DEV_AUTO_LOGIN !== "1") {
    return false;
  }
  if (process.env.VERCEL) {
    return false;
  }

  const email = process.env.DEV_LOGIN_EMAIL?.trim();
  const password = process.env.DEV_LOGIN_PASSWORD;
  if (!email || !password || password.trim().length === 0) {
    return false;
  }

  if (!isLoopbackHostname(request.nextUrl.hostname)) {
    return false;
  }

  const requestUrl = readRequestUrl(request);
  if (!requestUrl || !isLoopbackHostname(requestUrl.hostname)) {
    return false;
  }

  const hostHeader = request.headers.get("host");
  if (hostHeader !== null) {
    const parsedHost = parseHostHeader(hostHeader);
    if (!parsedHost || !isLoopbackHostname(parsedHost.hostname)) {
      return false;
    }
  }

  return true;
}

export function resolveDevLoginOrigin(request: NextRequest): string {
  const hostHeader = request.headers.get("host");
  if (hostHeader !== null) {
    const parsedHost = parseHostHeader(hostHeader);
    if (parsedHost && isLoopbackHostname(parsedHost.hostname)) {
      const protocol =
        request.nextUrl.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${parsedHost.host}`;
    }
  }

  const requestUrl = readRequestUrl(request);
  if (requestUrl) {
    return requestUrl.origin;
  }
  return request.nextUrl.origin;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateHttpUrl(name: string, rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  return rawUrl;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = validateHttpUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  );
  const anonKey = readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request,
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  if ((!user || error) && !isDevLoginPath(pathname)) {
    if (
      isDevAutoLoginEnabled(request) &&
      (pathname === "/" || isProtectedPath(pathname))
    ) {
      const nextPath =
        pathname === "/" ? "/nogs" : `${pathname}${request.nextUrl.search}`;
      const redirectUrl = new URL(
        DEV_LOGIN_PATH,
        resolveDevLoginOrigin(request),
      );
      redirectUrl.searchParams.set("next", nextPath);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      return redirectResponse;
    }

    if (isProtectedPath(pathname)) {
      const returnPath = `${pathname}${request.nextUrl.search}`;
      const redirectUrl = new URL(
        `/login?next=${encodeURIComponent(returnPath)}`,
        request.nextUrl.origin,
      );
      const redirectResponse = NextResponse.redirect(redirectUrl);
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|glb)$).*)",
  ],
};
