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

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-4 pt-6 pb-12 md:px-10 lg:py-12">
        <div className="flex w-full flex-col items-center justify-center lg:flex-row lg:items-center">
          <div className="relative z-20 -mb-6 w-[220px] shrink-0 lg:pointer-events-none lg:[&_*]:!pointer-events-none lg:-mr-[172px] lg:mb-0 lg:w-[520px] xl:-mr-48 xl:w-[600px]">
            <div className="nog-bob">
              <NogStage
                scene="lean"
                alt="A Nog waving hello"
                poster="/nog/peek-card.png"
                width={1254}
                height={1254}
                priority
                sizes="(min-width: 1280px) 600px, (min-width: 1024px) 520px, 220px"
                className="w-full"
              />
            </div>
          </div>

          <section className="relative z-10 w-full max-w-[620px] rounded-[32px] bg-[var(--noggin-card-glass)] px-6 pt-10 pb-8 shadow-[0_18px_48px_var(--noggin-shadow)] backdrop-blur-[8px] sm:px-10 sm:py-12 lg:w-[560px] lg:max-w-[660px] lg:shrink-0 lg:rounded-[56px] lg:px-12 lg:py-12 xl:w-[640px] xl:px-14 xl:py-14">
            {children}
          </section>
        </div>
      </main>
    </>
  );
}
