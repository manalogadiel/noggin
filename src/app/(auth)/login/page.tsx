import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <AuthFrame headerAction={{ label: "Sign up", href: "/signup" }}>
      <h1 className="noggin-display text-center text-[clamp(1.875rem,3vw,2.75rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
        Hello,{" "}
        <span className="text-[var(--noggin-leaf-strong)]">Welcome Back!</span>
      </h1>
      <p className="noggin-display mt-2 text-center text-[1.1875rem] font-light text-[var(--noggin-forest)]">
        Your Nog misses you.
      </p>

      <LoginForm nextPath={nextPath} />
    </AuthFrame>
  );
}
