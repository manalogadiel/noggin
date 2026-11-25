import type { ReactNode } from "react";
import { NogStage } from "@/components/nog-3d/nog-stage";
import {
  PublicHeader,
  type PublicHeaderAction,
} from "@/components/shell/public-header";

export interface AuthFrameProps {
  headerAction: PublicHeaderAction;
  children: ReactNode;
}

export function AuthFrame({ headerAction, children }: AuthFrameProps) {
  return (
    <>
      <PublicHeader action={headerAction} />

      <main className="figma-auth-main">
        <div className="figma-auth-group">
          <div className="figma-auth-nog">
            <div className="nog-bob">
              <NogStage
                scene="lean"
                alt="A Nog waving hello"
                poster="/nog/peek-card.png"
                width={1254}
                height={1254}
                priority
                sizes="(min-width: 1280px) 740px, (min-width: 1024px) 520px, 215px"
                className="w-full"
              />
            </div>
          </div>

          <section className="figma-auth-card">
            {children}
          </section>
        </div>
      </main>
    </>
  );
}
