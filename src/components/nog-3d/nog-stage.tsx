"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type NogSceneName = "trio" | "flying" | "thinking" | "peek";

// three.js stays out of every other page: this chunk loads only when a Nog nears the viewport.
const NogCanvas = dynamic(() => import("./nog-rig"), { ssr: false });

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface NogStageProps {
  scene: NogSceneName;
  alt: string;
  poster: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}

export function NogStage({ scene, alt, poster, width, height, sizes, priority, className }: NogStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !supportsWebGl()) return;
    const motion = window.matchMedia(REDUCED_MOTION);
    // Load the canvas a little before it scrolls in; render frames only while it is on screen.
    const loader = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !motion.matches) setMounted(true);
      },
      { rootMargin: "200px" },
    );
    const onScreen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    const onMotionChange = () => {
      if (motion.matches) {
        setMounted(false);
        setReady(false);
      }
    };
    loader.observe(element);
    onScreen.observe(element);
    motion.addEventListener("change", onMotionChange);
    return () => {
      loader.disconnect();
      onScreen.disconnect();
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => {
    setMounted(false);
    setReady(false);
  }, []);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      data-nog-3d={ready ? "ready" : "poster"}
      className={cn("relative", className)}
    >
      <Image
        src={poster}
        alt=""
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={cn("h-auto w-full object-contain transition-opacity duration-300", ready && "opacity-0")}
      />
      {mounted && (
        <NogCanvas
          scene={scene}
          active={visible}
          onReady={onReady}
          onFail={onFail}
          className={cn(
            "!absolute inset-0 transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
