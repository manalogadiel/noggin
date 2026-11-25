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
      <div style={{ textAlign: "center" }}>
        <h1 className="figma-auth-title">
          Hello, <span>Welcome Back!</span>
        </h1>
        <p className="figma-auth-sub">Your Nog misses you.</p>
      </div>

      <LoginForm nextPath={nextPath} />
    </AuthFrame>
  );
}
