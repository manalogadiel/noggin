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
      <div style={{ textAlign: "center" }}>
        <h1 className="figma-auth-title">
          Hatch your <span>Nog</span>
        </h1>
        <p className="figma-auth-sub">Teach it, raise it, watch it grow.</p>
      </div>

      <SignupForm maxBirthday={maxBirthday} />
    </AuthFrame>
  );
}
