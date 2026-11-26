"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
  TextureLoader,
  Vector3,
  Vector4,
} from "three";
import type { NogSceneName } from "./nog-stage";

/**
 * The Figma render itself, bent by a fine mesh (the way Live2D/Spine animate 2D art): eyes slide
 * toward the cursor and squash shut to blink, leaves sway, arms wave, bodies breathe, hop and squish.
 * Coordinates are fractions of the image (u across, v down), measured on the renders.
 */

type UV = [number, number];
/** rigid: holds a prop (the book), so taps bounce it evenly instead of squashing it out of shape */
interface BodyRig { base: UV; center: UV; radius: UV; hop?: boolean; float?: boolean; rigid?: boolean; slow?: boolean }
interface EyeRig { center: UV; radius: UV; body: number }
interface LimbRig { pivot: UV; center: UV; radius: UV; body: number; amp: number; speed?: number; idle?: boolean }
interface Rig {
  poster: string;
  aspect: number;
  bodies: BodyRig[];
  eyes: EyeRig[];
  leaves: LimbRig[];
  arms: LimbRig[];
}

export const RIGS: Record<NogSceneName, Rig> = {
  trio: {
    poster: "/nog/landing-trio.png",
    aspect: 1024 / 646,
    bodies: [
      { base: [0.585, 0.8], center: [0.585, 0.5], radius: [0.15, 0.31], hop: true },
      { base: [0.355, 0.84], center: [0.355, 0.6], radius: [0.14, 0.26], hop: true },
      { base: [0.76, 0.855], center: [0.76, 0.69], radius: [0.125, 0.18], hop: true },
    ],
    eyes: [
      { center: [0.5201, 0.3622], radius: [0.02, 0.0317], body: 0 },
      { center: [0.6507, 0.3903], radius: [0.019, 0.0317], body: 0 },
      { center: [0.2947, 0.5069], radius: [0.0181, 0.0302], body: 1 },
      { center: [0.4099, 0.5116], radius: [0.0176, 0.0302], body: 1 },
      { center: [0.7223, 0.6585], radius: [0.0166, 0.0271], body: 2 },
      { center: [0.8225, 0.6211], radius: [0.0142, 0.024], body: 2 },
    ],
    leaves: [
      { pivot: [0.588, 0.225], center: [0.588, 0.13], radius: [0.14, 0.12], body: 0, amp: 0.07 },
      { pivot: [0.345, 0.365], center: [0.34, 0.29], radius: [0.1, 0.1], body: 1, amp: 0.08 },
    ],
    arms: [
      { pivot: [0.715, 0.5], center: [0.765, 0.42], radius: [0.06, 0.11], body: 0, amp: 0.22 },
      { pivot: [0.24, 0.6], center: [0.205, 0.55], radius: [0.05, 0.08], body: 1, amp: -0.25 },
    ],
  },
  flying: {
    poster: "/nog/flying-book.png",
    aspect: 1,
    // one Nog fills the image: the body region covers all of it so squash and float stay rigid (the book never bends)
    bodies: [{ base: [0.45, 0.6], center: [0.45, 0.58], radius: [1.6, 1.6], float: true, rigid: true }],
    eyes: [
      { center: [0.2692, 0.4087], radius: [0.0343, 0.0391], body: 0 },
      { center: [0.4812, 0.463], radius: [0.0435, 0.0435], body: 0 },
    ],
    leaves: [{ pivot: [0.41, 0.285], center: [0.45, 0.17], radius: [0.25, 0.14], body: 0, amp: 0.06 }],
    arms: [
      { pivot: [0.2, 0.47], center: [0.1, 0.44], radius: [0.11, 0.08], body: 0, amp: 0.16, speed: 2.2, idle: true },
      // the hand holding the book: the region covers the whole book so it swings without bending
      { pivot: [0.6, 0.55], center: [0.78, 0.55], radius: [0.25, 0.2], body: 0, amp: -0.09, speed: 2.2, idle: true },
      { pivot: [0.7, 0.75], center: [0.78, 0.82], radius: [0.12, 0.1], body: 0, amp: 0.1, speed: 1.6, idle: true },
    ],
  },
  thinking: {
    poster: "/nog/thinking.png",
    aspect: 1,
    bodies: [{ base: [0.45, 0.86], center: [0.46, 0.55], radius: [0.26, 0.36] }],
    eyes: [
      { center: [0.3998, 0.3846], radius: [0.0303, 0.0259], body: 0 },
      { center: [0.5206, 0.4418], radius: [0.0335, 0.0331], body: 0 },
    ],
    leaves: [{ pivot: [0.522, 0.31], center: [0.52, 0.2], radius: [0.18, 0.12], body: 0, amp: 0.06 }],
    arms: [
      { pivot: [0.6, 0.62], center: [0.52, 0.56], radius: [0.08, 0.06], body: 0, amp: 0.05, speed: 3, idle: true },
      { pivot: [0.27, 0.62], center: [0.235, 0.68], radius: [0.045, 0.07], body: 0, amp: 0.08, speed: 1.2, idle: true },
    ],
  },
  peek: {
    poster: "/nog/egg-peek.png",
    aspect: 1192 / 1320,
    bodies: [{ base: [0.5, 0.62], center: [0.5, 0.42], radius: [0.3, 0.24] }],
    eyes: [
      { center: [0.4109, 0.4689], radius: [0.0398, 0.0367], body: 0 },
      { center: [0.6243, 0.4274], radius: [0.0357, 0.0322], body: 0 },
    ],
    leaves: [{ pivot: [0.48, 0.3], center: [0.46, 0.2], radius: [0.2, 0.12], body: 0, amp: 0.06 }],
    arms: [{ pivot: [0.73, 0.53], center: [0.79, 0.49], radius: [0.065, 0.065], body: 0, amp: -0.32 }],
  },
  lean: {
    poster: "/nog/peek-card.png",
    aspect: 1,
    bodies: [{ base: [0.46, 0.83], center: [0.46, 0.55], radius: [0.27, 0.36] }],
    eyes: [
      { center: [0.3995, 0.5076], radius: [0.0327, 0.0335], body: 0 },
      { center: [0.5895, 0.4659], radius: [0.0299, 0.0319], body: 0 },
    ],
    leaves: [{ pivot: [0.45, 0.33], center: [0.43, 0.24], radius: [0.2, 0.12], body: 0, amp: 0.06 }],
    arms: [
      { pivot: [0.66, 0.53], center: [0.71, 0.5], radius: [0.055, 0.055], body: 0, amp: -0.2 },             // waves hello
      { pivot: [0.27, 0.62], center: [0.245, 0.68], radius: [0.04, 0.07], body: 0, amp: 0.06, speed: 1.2, idle: true },
    ],
  },
  egg: {
    poster: "/nog/egg-speckled.png",
    aspect: 605 / 589,
    bodies: [{ base: [0.5, 0.86], center: [0.5, 0.48], radius: [0.3, 0.4] }],
    eyes: [],
    leaves: [],
    arms: [],
  },
  hatched: {
    poster: "/nog/hatched-shells.png",
    aspect: 1583 / 994,
    bodies: [{ base: [0.48, 0.8], center: [0.48, 0.62], radius: [0.17, 0.22] }],
    eyes: [
      { center: [0.4298, 0.5785], radius: [0.0234, 0.0367], body: 0 },
      { center: [0.5747, 0.5288], radius: [0.0205, 0.0337], body: 0 },
    ],
    leaves: [],
    arms: [],
  },
  room: {
    poster: "/nog/blob-closeup.png",
    aspect: 1,
    bodies: [{ base: [0.5, 0.9], center: [0.5, 0.62], radius: [0.42, 0.34] }],
    eyes: [
      { center: [0.4342, 0.6711], radius: [0.0323, 0.0323], body: 0 },
      { center: [0.6292, 0.6244], radius: [0.0271, 0.0287], body: 0 },
    ],
    leaves: [],
    arms: [],
  },
  dizzy: {
    poster: "/nog/hatchling-dizzy.png",
    aspect: 1,
    // spiral eyes stay intact: animate the body only without eye handles
    bodies: [{ base: [0.5, 0.86], center: [0.5, 0.58], radius: [0.45, 0.45], float: true }],
    eyes: [],
    leaves: [],
    arms: [],
  },
  sleeping: {
    poster: "/nog/sleeping-books.png",
    aspect: 908 / 721,
    // closed eyes stay intact: one rigid-ish body breathing slowly without eye handles
    bodies: [{ base: [0.5, 0.8], center: [0.47, 0.52], radius: [0.24, 0.2], rigid: true, slow: true }],
    eyes: [],
    leaves: [],
    arms: [],
  },
};

/** Last pointer position in viewport pixels, shared by every Nog on the page. */
const pointer = { x: Number.NaN, y: Number.NaN };

const MAX = { bodies: 3, eyes: 6, leaves: 3, arms: 4 };

const vertexShader = /* glsl */ `
uniform float uAspect;
uniform vec4 uBodyA[${MAX.bodies}]; uniform vec4 uBodyB[${MAX.bodies}]; uniform vec4 uBodyC[${MAX.bodies}];
uniform vec4 uEyeA[${MAX.eyes}]; uniform vec4 uEyeB[${MAX.eyes}];
uniform vec4 uLeafA[${MAX.leaves}]; uniform vec4 uLeafB[${MAX.leaves}];
uniform vec4 uArmA[${MAX.arms}]; uniform vec4 uArmB[${MAX.arms}];
uniform int uBodies; uniform int uEyes; uniform int uLeaves; uniform int uArms;
varying vec2 vUv;

float fall(vec2 p, vec2 c, vec2 r) { return 1.0 - smoothstep(0.55, 1.0, length((p - c) / r)); }
vec2 rotAbout(vec2 p, vec2 o, float a) { float c = cos(a), s = sin(a); vec2 q = p - o; return o + vec2(c * q.x - s * q.y, s * q.x + c * q.y); }

// breathe / squash / tilt / hop each body, weighted by where the point started
vec2 bodies(vec2 p, vec2 p0) {
  for (int i = 0; i < ${MAX.bodies}; i++) {
    if (i >= uBodies) break;
    vec4 A = uBodyA[i]; vec4 B = uBodyB[i]; vec4 C = uBodyC[i];
    vec2 t = A.xy + (p - A.xy) * C.xy;
    t = rotAbout(t, A.xy, B.z);
    t.y -= B.w;
    p = mix(p, t, fall(p0, A.zw, B.xy));
  }
  return p;
}

void main() {
  vUv = uv;
  vec2 p0 = vec2(uv.x * uAspect, 1.0 - uv.y);
  vec2 p = p0;
  for (int i = 0; i < ${MAX.arms}; i++) {
    if (i >= uArms) break;
    p = mix(p, rotAbout(p, uArmA[i].xy, uArmB[i].z), fall(p0, uArmA[i].zw, uArmB[i].xy));
  }
  for (int i = 0; i < ${MAX.leaves}; i++) {
    if (i >= uLeaves) break;
    // only the leaves above the stem move; the head under them stays put
    float w = fall(p0, uLeafA[i].zw, uLeafB[i].xy) * (1.0 - smoothstep(uLeafA[i].y - 0.015, uLeafA[i].y + 0.02, p0.y));
    p = mix(p, rotAbout(p, uLeafA[i].xy, uLeafB[i].z), w);
  }
  p = bodies(p, p0);
  // eyes last, around where the body moved them: a blink only compresses, so the mesh never folds
  for (int i = 0; i < ${MAX.eyes}; i++) {
    if (i >= uEyes) break;
    vec4 A = uEyeA[i]; vec4 B = uEyeB[i];
    vec2 c = bodies(A.xy, A.xy) + B.xy;
    p += B.xy * fall(p0, A.xy, A.zw * 2.6);
    p.y = mix(p.y, c.y + (p.y - c.y) * B.z, fall(p0, A.xy, A.zw * 1.45));
  }
  gl_Position = vec4(p.x / uAspect * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  float leaf = step(c.r * 1.12, c.g) * step(c.b * 1.12, c.g);
  c.rgb = mix(c.rgb * uTint, c.rgb, leaf);
  gl_FragColor = c;
}
`;

const vec4s = (n: number) => Array.from({ length: n }, () => new Vector4());

function parseTintRgb(tint?: string | null): [number, number, number] {
  if (!tint) return [1, 1, 1];
  const clean = tint.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return [1, 1, 1];
  const num = Number.parseInt(clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

function createMaterial(rig: Rig, texture: Texture): ShaderMaterial {
  const a = rig.aspect;
  const toP = ([u, v]: UV): [number, number] => [u * a, v];
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      uMap: { value: texture },
      uTint: { value: new Vector3(1, 1, 1) },
      uAspect: { value: a },
      uBodyA: { value: vec4s(MAX.bodies) },
      uBodyB: { value: vec4s(MAX.bodies) },
      uBodyC: { value: vec4s(MAX.bodies) },
      uEyeA: { value: vec4s(MAX.eyes) },
      uEyeB: { value: vec4s(MAX.eyes) },
      uLeafA: { value: vec4s(MAX.leaves) },
      uLeafB: { value: vec4s(MAX.leaves) },
      uArmA: { value: vec4s(MAX.arms) },
      uArmB: { value: vec4s(MAX.arms) },
      uBodies: { value: rig.bodies.length },
      uEyes: { value: rig.eyes.length },
      uLeaves: { value: rig.leaves.length },
      uArms: { value: rig.arms.length },
    },
  });
  const u = material.uniforms;
  rig.eyes.forEach((e, i) => u.uEyeA.value[i].set(...toP(e.center), e.radius[0] * a, e.radius[1]));
  rig.leaves.forEach((l, i) => u.uLeafA.value[i].set(...toP(l.pivot), ...toP(l.center)));
  rig.arms.forEach((l, i) => u.uArmA.value[i].set(...toP(l.pivot), ...toP(l.center)));
  rig.bodies.forEach((b, i) => u.uBodyA.value[i].set(...toP(b.base), ...toP(b.center)));
  rig.bodies.forEach((_, i) => u.uBodyC.value[i].set(1, 1, 0, 0));
  rig.eyes.forEach((_, i) => u.uEyeB.value[i].set(0, 0, 1, 0));
  return material;
}

function RiggedNog({
  rig,
  texture,
  tint,
  onReady,
}: {
  rig: Rig;
  texture: Texture;
  tint?: string | null;
  onReady: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const a = rig.aspect;
  const material = useMemo(() => createMaterial(rig, texture), [rig, texture]);

  useEffect(() => {
    const [r, g, b] = parseTintRgb(tint);
    material.uniforms.uTint.value.set(r, g, b);
  }, [material, tint]);
  // Fine mesh (~1 vertex every 4px) so eyes squash smoothly without heavy mount CPU cost.
  const geometry = useMemo(
    () => new PlaneGeometry(1, 1, Math.round(96 * Math.max(a, 1)), Math.round(96 / Math.min(a, 1))),
    [a],
  );
  const anim = useRef(
    rig.bodies.map((_, i) => ({
      tapAt: -10,
      tapped: false,
      nextBlink: 1.2 + i * 1.1,
      blinkAt: -1,
      nextHop: 5 + i * 2.7,
      hopAt: -1,
      look: [0, 0] as [number, number],
    })),
  );
  const ready = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const u = (event.clientX - rect.left) / rect.width;
      const v = (event.clientY - rect.top) / rect.height;
      let best = -1;
      let bestDistance = 1;
      rig.bodies.forEach((b, i) => {
        const d = Math.hypot((u - b.center[0]) / b.radius[0], (v - b.center[1]) / b.radius[1]);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      if (best >= 0) anim.current[best].tapped = true;
    };
    canvas.addEventListener("pointerdown", onDown);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      material.dispose();
      geometry.dispose();
    };
  }, [gl, rig, material, geometry]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const u = material.uniforms;
    let rect: DOMRect | null = null;

    rig.bodies.forEach((b, i) => {
      const s = anim.current[i];
      if (s.tapped) {
        s.tapped = false;
        s.tapAt = t;
      }
      const tap = t - s.tapAt;
      const squash = tap < 0.9 ? -0.09 * Math.exp(-5.5 * tap) * Math.cos(15 * tap) : 0;
      const breathPeriod = b.slow ? 5.2 : 3.4;
      const breath = 0.012 * Math.sin((t + i * 1.3) * ((2 * Math.PI) / breathPeriod));
      let lift = b.float ? Math.sin(t * 0.9) * 0.012 : 0;
      if (b.hop) {
        if (s.hopAt < 0 && t > s.nextHop) s.hopAt = t;
        if (s.hopAt >= 0) {
          const h = t - s.hopAt;
          if (h < 0.45) lift = Math.sin((h / 0.45) * Math.PI) * 0.035;
          else {
            s.hopAt = -1;
            s.nextHop = t + 8 + ((i * 3.1) % 4);
            s.tapAt = t;
          }
        }
      }
      const stretch = breath + squash;
      const tilt = b.float ? Math.sin(t * 0.7) * 0.025 : 0;
      u.uBodyB.value[i].set(b.radius[0] * a, b.radius[1], tilt, lift);
      if (b.rigid) u.uBodyC.value[i].set(1 + stretch * 0.5, 1 + stretch * 0.5, 0, 0);
      else u.uBodyC.value[i].set(1 - stretch * 0.6, 1 + stretch, 0, 0);

      // blink: quick squash; double blink now and then; squint after a tap
      if (s.blinkAt < 0 && t > s.nextBlink) s.blinkAt = t;
      let lid = 1;
      if (s.blinkAt >= 0) {
        const k = t - s.blinkAt;
        if (k < 0.13) lid = 0.12;
        else if (k < 0.2) lid = 1;
        else if (k < 0.31 && i % 2 === 1) lid = 0.12;
        else {
          s.blinkAt = -1;
          s.nextBlink = t + 2.4 + ((i * 7.3 + t) % 2.6);
        }
      }
      if (tap < 0.55) lid = Math.min(lid, 0.45);

      // eyes look toward the pointer, relative to this Nog on screen
      let tx = 0;
      let ty = 0;
      if (Number.isFinite(pointer.x)) {
        rect ??= gl.domElement.getBoundingClientRect();
        const cx = rect.left + b.center[0] * rect.width;
        const cy = rect.top + b.center[1] * rect.height;
        tx = Math.max(-1, Math.min(1, (pointer.x - cx) / (window.innerWidth / 2))) * 0.012;
        ty = Math.max(-1, Math.min(1, (pointer.y - cy) / (window.innerHeight / 2))) * 0.009;
      }
      s.look[0] += (tx - s.look[0]) * 0.08;
      s.look[1] += (ty - s.look[1]) * 0.08;
      rig.eyes.forEach((e, j) => {
        if (e.body === i) u.uEyeB.value[j].set(s.look[0], s.look[1], lid, i);
      });
    });

    rig.leaves.forEach((l, j) => {
      const tap = t - anim.current[l.body].tapAt;
      const wiggle = tap < 0.8 ? Math.sin(tap * 26) * 0.12 * (1 - tap / 0.8) : 0;
      u.uLeafB.value[j].set(l.radius[0] * a, l.radius[1], Math.sin(t * 1.1 + j) * l.amp + wiggle, l.body);
    });

    rig.arms.forEach((l, j) => {
      let angle: number;
      if (l.idle) angle = Math.sin(t * (l.speed ?? 2) + j) * l.amp;
      else {
        // wave twice, then rest a few seconds
        const cycle = (t + j * 1.7) % 6;
        angle = cycle < 2.4 ? Math.sin((cycle / 1.2) * Math.PI * 2) * l.amp : 0;
      }
      u.uArmB.value[j].set(l.radius[0] * a, l.radius[1], angle, l.body);
    });

    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(onReady);
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export interface NogRigCanvasProps {
  scene: NogSceneName;
  active: boolean;
  tint?: string | null;
  onReady: () => void;
  onFail: () => void;
  className?: string;
}

export default function NogRigCanvas({ scene, active, tint, onReady, onFail, className }: NogRigCanvasProps) {
  const rig = RIGS[scene];
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: Texture | null = null;
    new TextureLoader()
      .loadAsync(rig.poster)
      .then((map) => {
        loaded = map;
        map.anisotropy = 4;
        // premultiplied upload avoids dark fringes when the edges are filtered
        map.premultiplyAlpha = true;
        map.needsUpdate = true;
        if (alive) setTexture(map);
        else map.dispose();
      })
      .catch(() => alive && onFail());
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => {
      alive = false;
      loaded?.dispose();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, [rig, onFail]);

  // The poster stays on screen until the image has loaded and the first frame is drawn.
  if (!texture) return null;

  return (
    <Canvas
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        cursor: "pointer",
      }}
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute("aria-hidden", "true");
        gl.domElement.addEventListener("webglcontextlost", onFail, { once: true });
      }}
    >
      <RiggedNog rig={rig} texture={texture} tint={tint} onReady={onReady} />
    </Canvas>
  );
}
