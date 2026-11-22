import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  const maxBirthday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());

  return (
    <AuthFrame headerAction={{ label: "Log in", href: "/login" }}>
      <h1 className="noggin-display text-center text-[clamp(1.875rem,3vw,2.75rem)] font-bold leading-[1.15] tracking-tight text-[var(--noggin-forest)]">
        Hatch your{" "}
        <span className="text-[var(--noggin-leaf-strong)]">Nog</span>
      </h1>
      <p className="noggin-display mt-2 text-center text-[1.1875rem] font-light text-[var(--noggin-forest)]">
        Teach it, raise it, watch it grow.
      </p>

      <SignupForm maxBirthday={maxBirthday} />
    </AuthFrame>
  );
}
