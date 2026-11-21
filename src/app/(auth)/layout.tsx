import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="noggin-public-bg flex min-h-[100dvh] flex-col overflow-x-clip">
      {children}
    </div>
  );
}
