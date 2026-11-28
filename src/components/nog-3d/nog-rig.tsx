"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Color,
  CustomBlending,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NogStageSlug } from "@/core/application/ports";
import { type LoadedGlbAsset, loadNormalizedGlb } from "./glb-loader";
import {
  ACCESSORY_GLB_MODELS,
  type GlbAssetEntry,
  type NogSpeciesId,
  resolveSceneGlb,
} from "./model-manifest";
import type { NogReaction, NogRoomTheme, NogSceneName } from "./nog-stage";
import {
  createContactShadowTexture,
  createStudioEnvironment,
  parseTintRgb,
  ROOM_LIGHT_PRESETS,
} from "./studio-lighting";

interface ScenePosterConfig {
  poster: string;
  aspect: number;
  float?: boolean;
  hop?: boolean;
  slow?: boolean;
}

const SCENE_POSTERS: Record<NogSceneName, ScenePosterConfig> = {
  trio: { poster: "/nog/landing-trio.png", aspect: 1024 / 646, hop: true },
  flying: { poster: "/nog/flying-book.png", aspect: 1, float: true },
  thinking: { poster: "/nog/thinking.png", aspect: 1 },
  peek: { poster: "/nog/egg-peek.png", aspect: 1192 / 1320 },
  lean: { poster: "/nog/peek-card.png", aspect: 1 },
  egg: { poster: "/nog/egg-speckled.png", aspect: 605 / 589 },
  hatched: { poster: "/nog/hatched-shells.png", aspect: 1583 / 994, hop: true },
  room: { poster: "/nog/blob-closeup.png", aspect: 1 },
  dizzy: { poster: "/nog/hatchling-dizzy.png", aspect: 1, float: true },
  sleeping: { poster: "/nog/sleeping-books.png", aspect: 908 / 721, slow: true },
};

/** Last pointer position in viewport pixels, shared across scenes. */
const pointer = { x: Number.NaN, y: Number.NaN };

/**
 * Distortion-free studio card shader: keeps the exact reference artwork untouched
 * (zero UV pixel-bending or limb/eye warping), while preserving green sprout leaves
 * when body color tints are applied.
 */
const cardVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const cardFragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  float leaf = step(c.r * 1.12, c.g) * step(c.b * 1.12, c.g);
  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float darkFeature = 1.0 - smoothstep(0.12, 0.24, luma);
  float mask = (1.0 - leaf) * (1.0 - darkFeature);
  c.rgb = mix(c.rgb, c.rgb * uTint, mask);
  gl_FragColor = c;
}
`;

function RigidStudioCard({
  config,
  texture,
  tint,
  reaction,
  onReady,
}: {
  config: ScenePosterConfig;
  texture: Texture;
  tint?: string | null;
  reaction?: NogReaction;
  onReady: () => void;
}) {
  const getThree = useThree((s) => s.get);
  const groupRef = useRef<Group | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const ready = useRef(false);
  const anim = useRef({
    tapAt: -10,
    nextHop: 6.2,
    hopAt: -1,
    tiltX: 0,
    tiltY: 0,
  });
  const clockNow = useRef(0);

  useEffect(() => {
    const { camera, size } = getThree();
    const viewAspect = size.width / Math.max(1, size.height);
    const camZ = 2.8;
    camera.position.set(0, 0, camZ);
    if ("fov" in camera && typeof camera.fov === "number") {
      camera.fov = 34;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, 0, 0);

    const visibleH = 2 * camZ * Math.tan(((34 * Math.PI) / 180) * 0.5);
    const visibleW = visibleH * viewAspect;
    const planeW = Math.min(visibleW, visibleH * config.aspect) * 0.96;
    const planeH = planeW / config.aspect;

    const geo = new PlaneGeometry(planeW, planeH, 1, 1);
    const [r, g, b] = parseTintRgb(tint);
    const mat = new ShaderMaterial({
      vertexShader: cardVertexShader,
      fragmentShader: cardFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      uniforms: {
        uMap: { value: texture },
        uTint: { value: new Vector3(r, g, b) },
      },
    });
    materialRef.current = mat;

    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    const mount = groupRef.current;
    mount?.add(mesh);

    return () => {
      mount?.remove(mesh);
      geo.dispose();
      mat.dispose();
      materialRef.current = null;
    };
    // Tint updates live via uniform without rebuilding the quad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getThree, config, texture]);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    const [r, g, b] = parseTintRgb(tint);
    mat.uniforms.uTint.value.set(r, g, b);
  }, [tint]);

  useEffect(() => {
    const { gl } = getThree();
    const canvas = gl.domElement;
    const onDown = () => {
      anim.current.tapAt = clockNow.current;
    };
    canvas.addEventListener("pointerdown", onDown);
    return () => canvas.removeEventListener("pointerdown", onDown);
  }, [getThree]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    clockNow.current = t;
    const group = groupRef.current;
    if (!group) return;

    const s = anim.current;
    const tap = t - s.tapAt;
    const period = config.slow ? 5.0 : 3.4;
    const breath = 0.012 * Math.sin(t * ((Math.PI * 2) / period));
    const tapBounce =
      tap >= 0 && tap < 0.72 ? -0.055 * Math.exp(-5.8 * tap) * Math.cos(16 * tap) : 0;
    const reactionPulse = reaction === "giggle" || reaction === "tickle" ? Math.sin(t * 10) * 0.014 : 0;

    // Subtle uniform breathing & pet bounce — zero uneven pixel stretching
    const scaleY = 1 + breath + tapBounce + reactionPulse;
    const scaleX = 1 - (breath + tapBounce) * 0.35;
    group.scale.set(scaleX, scaleY, 1);

    let lift = config.float ? Math.sin(t * 1.15) * 0.045 : 0;
    if (config.hop) {
      if (s.hopAt < 0 && t > s.nextHop) s.hopAt = t;
      if (s.hopAt >= 0) {
        const h = t - s.hopAt;
        if (h < 0.42) lift += Math.sin((h / 0.42) * Math.PI) * 0.055;
        else {
          s.hopAt = -1;
          s.nextHop = t + 8.5;
          s.tapAt = t;
        }
      }
    }
    if (tap >= 0 && tap < 0.34) {
      lift += Math.sin((tap / 0.34) * Math.PI) * 0.038;
    }
    group.position.y = lift;

    // Gentle 3D perspective follow toward pointer (rigid card tilt — zero face distortion)
    let tx = 0;
    let ty = 0;
    if (Number.isFinite(pointer.x) && !config.slow) {
      const { gl } = getThree();
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      tx = Math.max(-1, Math.min(1, (pointer.x - cx) / Math.max(240, window.innerWidth * 0.45)));
      ty = Math.max(-1, Math.min(1, (pointer.y - cy) / Math.max(240, window.innerHeight * 0.45)));
    }
    s.tiltX += (tx - s.tiltX) * 0.08;
    s.tiltY += (ty - s.tiltY) * 0.08;

    group.rotation.y = s.tiltX * 0.14;
    group.rotation.x = s.tiltY * 0.07;
    group.rotation.z = config.float ? Math.sin(t * 0.85) * 0.028 : -s.tiltX * 0.015;

    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(onReady);
    }
  });

  return <group ref={groupRef} />;
}

function GlbStudioScene({
  entry,
  asset,
  equippedAccessories,
  reaction = "idle",
  tapCount = 0,
  mood = null,
  speaking = false,
  roomTheme = "day",
  interactiveOrbit = false,
  onReady,
}: {
  entry: GlbAssetEntry;
  asset: LoadedGlbAsset;
  equippedAccessories?: readonly (string | null)[];
  reaction?: NogReaction;
  tapCount?: number;
  mood?: string | null;
  speaking?: boolean;
  roomTheme?: NogRoomTheme;
  interactiveOrbit?: boolean;
  onReady: () => void;
}) {
  const getThree = useThree((s) => s.get);
  const worldRef = useRef<Group | null>(null);
  const modelWrapRef = useRef<Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const lightsRef = useRef<{
    key: DirectionalLight;
    fill: DirectionalLight;
    rim: DirectionalLight;
    hemi: HemisphereLight;
  } | null>(null);
  const tapAtRef = useRef(-10);
  const clockNowRef = useRef(0);
  const lookRef = useRef({ x: 0, y: 0 });
  const exprRef = useRef({ reaction, mood, speaking, tiltZ: 0, nodX: 0 });
  const limbsRef = useRef<{
    armRight: ReturnType<Group["getObjectByName"]>;
    armLeft: ReturnType<Group["getObjectByName"]>;
    leaves: ReturnType<Group["getObjectByName"]>;
    cur: { rx: number; ry: number; rz: number; lx: number; lz: number; sx: number; sz: number };
  }>({
    armRight: undefined,
    armLeft: undefined,
    leaves: undefined,
    cur: { rx: 0, ry: 0, rz: 0, lx: 0, lz: 0, sx: 0, sz: 0 },
  });
  const ready = useRef(false);

  useEffect(() => {
    exprRef.current.reaction = reaction;
    exprRef.current.mood = mood;
    exprRef.current.speaking = speaking;
  }, [reaction, mood, speaking]);

  useEffect(() => {
    if (tapCount > 0) {
      tapAtRef.current = clockNowRef.current;
    }
  }, [tapCount]);

  // Studio softbox reflections + 3-point rig + soft floor contact shadow
  useEffect(() => {
    const { gl, scene: threeScene, camera } = getThree();
    const env = createStudioEnvironment(gl);
    threeScene.environment = env.texture;

    const key = new DirectionalLight(0xffffff, 1.9);
    key.position.set(-2.6, 4.2, 3.8);
    const fill = new DirectionalLight(0xe6f0ff, 0.45);
    fill.position.set(3.2, 1.8, 2.4);
    const rim = new DirectionalLight(0xfff2dc, 0.58);
    rim.position.set(0.6, 2.8, -3.4);
    const hemi = new HemisphereLight(0xf8fbff, 0xc8baaa, 0.92);
    lightsRef.current = { key, fill, rim, hemi };

    const h = entry.targetHeight ?? 1.25;
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new PlaneGeometry(h * 1.1, h * 1.05);
    const shadowMat = new MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    });
    const shadowMesh = new Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, (entry.yOffset ?? 0) + 0.002, 0.02);

    const targetY = entry.cameraTargetY ?? (entry.yOffset ?? 0) + (entry.targetHeight ?? 1.25) * 0.52;
    const dist = entry.cameraDistance ?? 3.1;
    camera.position.set(0, targetY + 0.14, dist);
    if ("fov" in camera && typeof camera.fov === "number") {
      camera.fov = 33;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(0, targetY, 0);

    const mount = worldRef.current;
    const limbs = limbsRef.current;
    const modelWrap = new Group();
    modelWrap.add(asset.root);
    modelWrapRef.current = modelWrap;
    limbs.armRight = asset.root.getObjectByName("arm_right_pivot");
    limbs.armLeft = asset.root.getObjectByName("arm_left_pivot");
    limbs.leaves = asset.root.getObjectByName("sprout_leaves_pivot");
    mount?.add(key, fill, rim, hemi, shadowMesh, modelWrap);

    if (asset.animations.length > 0) {
      const mixer = new AnimationMixer(asset.root);
      mixer.clipAction(asset.animations[0]).play();
      mixerRef.current = mixer;
    }

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      limbs.armRight = undefined;
      limbs.armLeft = undefined;
      limbs.leaves = undefined;
      mount?.remove(key, fill, rim, hemi, shadowMesh, modelWrap);
      modelWrap.remove(asset.root);
      modelWrapRef.current = null;
      lightsRef.current = null;
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      threeScene.environment = null;
      env.dispose();
    };
  }, [getThree, asset, entry.targetHeight, entry.cameraTargetY, entry.cameraDistance, entry.yOffset]);

  // Room-matched lighting preset updates
  useEffect(() => {
    const lights = lightsRef.current;
    if (!lights) return;
    const { scene: threeScene } = getThree();
    const preset = ROOM_LIGHT_PRESETS[roomTheme] ?? ROOM_LIGHT_PRESETS.day;
    lights.key.color.set(preset.keyColor);
    lights.key.intensity = preset.keyIntensity;
    lights.fill.color.set(preset.fillColor);
    lights.fill.intensity = preset.fillIntensity;
    lights.rim.color.set(preset.rimColor);
    lights.rim.intensity = preset.rimIntensity;
    lights.hemi.color.set(preset.hemiSky);
    lights.hemi.groundColor.set(preset.hemiGround);
    lights.hemi.intensity = preset.hemiIntensity;
    threeScene.environmentIntensity = preset.envIntensity;
  }, [getThree, roomTheme]);

  // Optional 360° damped turntable drag on Customize
  useEffect(() => {
    if (!interactiveOrbit) {
      controlsRef.current?.dispose();
      controlsRef.current = null;
      return;
    }
    const { gl, camera } = getThree();
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.8;
    controls.minPolarAngle = Math.PI * 0.34;
    controls.maxPolarAngle = Math.PI * 0.56;
    const targetY = entry.cameraTargetY ?? (entry.yOffset ?? 0) + (entry.targetHeight ?? 1.25) * 0.52;
    controls.target.set(0, targetY, 0);
    controls.update();
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [getThree, interactiveOrbit, entry.targetHeight, entry.cameraTargetY, entry.yOffset]);

  // Mount registered accessory GLBs onto the model's top/eye anchor heights
  const accSig = (equippedAccessories ?? []).map((x) => x ?? "").join("|");
  useEffect(() => {
    const wrap = modelWrapRef.current;
    if (!wrap) return;
    let alive = true;
    const mounted: LoadedGlbAsset[] = [];
    const accGroup = new Group();
    wrap.add(accGroup);

    const activeIds = (equippedAccessories ?? []).filter(
      (id): id is "glasses" | "beanie" | "bow" | "gradcap" =>
        id === "glasses" || id === "beanie" || id === "bow" || id === "gradcap",
    );

    const wearingHat = activeIds.includes("beanie") || activeIds.includes("gradcap");
    const sproutLeaves =
      asset.root.getObjectByName("sprout_leaves_pivot") ??
      asset.root.getObjectByName("sprout_leaves");
    if (sproutLeaves) {
      sproutLeaves.visible = !wearingHat;
    }

    void Promise.all(
      activeIds.map(async (id) => {
        const spec = ACCESSORY_GLB_MODELS[id];
        if (!spec) return;
        const loaded = await loadNormalizedGlb(spec);
        if (!loaded) return;
        if (!alive) {
          loaded.dispose();
          return;
        }
        const h = entry.targetHeight ?? 1.25;
        const baseY = entry.yOffset ?? 0;
        const override = entry.accessoryAnchors?.[id];
        const anchor = override?.anchor ?? spec.anchor;
        const rotation = override?.rotation ?? spec.rotation;
        const scaleMult = override?.scaleMultiplier ?? 1;
        if (anchor) {
          loaded.root.scale.setScalar(h * scaleMult);
          loaded.root.position.set(
            anchor[0] * h,
            baseY + anchor[1] * h,
            anchor[2] * h,
          );
        } else if (id === "glasses") {
          loaded.root.position.set(0, baseY + h * 0.48, 0.38);
        } else if (id === "bow") {
          loaded.root.position.set(0.24, baseY + h * 0.84, 0.14);
        } else {
          loaded.root.position.set(0, baseY + h * 0.86, 0);
        }
        if (rotation) {
          loaded.root.rotation.set(rotation[0], rotation[1], rotation[2]);
        }
        accGroup.add(loaded.root);
        mounted.push(loaded);
      }),
    );

    return () => {
      alive = false;
      if (sproutLeaves) {
        sproutLeaves.visible = true;
      }
      wrap.remove(accGroup);
      mounted.forEach((m) => m.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accSig, asset, entry.targetHeight]);

  // Tap-to-bounce without interfering with turntable drags
  useEffect(() => {
    const { gl } = getThree();
    const dom = gl.domElement;
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) <= 8) {
        tapAtRef.current = clockNowRef.current;
      }
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
    };
  }, [getThree]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    clockNowRef.current = t;
    mixerRef.current?.update(Math.min(delta, 0.05));
    controlsRef.current?.update();

    const wrap = modelWrapRef.current;
    if (wrap) {
      const expr = exprRef.current;
      const tap = t - tapAtRef.current;
      const isSleepy = expr.mood === "sleepy";
      const isUpbeat =
        expr.mood === "excited" ||
        expr.mood === "proud" ||
        expr.reaction === "giggle" ||
        expr.reaction === "tickle";
      const isQuizzical = expr.mood === "confused" || expr.mood === "curious";
      const isStartled = expr.mood === "shocked" || expr.reaction === "annoyed";

      const breath = (isSleepy ? 0.022 : 0.015) * Math.sin(t * (isSleepy ? 1.05 : 1.9));
      const speakPulse = expr.speaking
        ? 0.032 * Math.abs(Math.sin(t * 10.5)) + 0.012 * Math.sin(t * 17)
        : 0;
      const upbeatBounce = isUpbeat ? 0.024 * Math.abs(Math.sin(t * 5.2)) : 0;
      const squish = tap >= 0 && tap < 0.8 ? -0.09 * Math.exp(-5.4 * tap) * Math.cos(16 * tap) : 0;
      const sy = 1 + breath + speakPulse + upbeatBounce + squish;
      const sxz = 1 / Math.sqrt(Math.max(0.75, sy));
      wrap.scale.set(sxz, sy, sxz);

      let lift = tap >= 0 && tap < 0.34 ? Math.sin((tap / 0.34) * Math.PI) * 0.06 : 0;
      if (isUpbeat) lift += Math.abs(Math.sin(t * 5.2)) * 0.032;
      if (expr.speaking) lift += Math.abs(Math.sin(t * 10.5)) * 0.012;
      wrap.position.y = lift;

      const targetTiltZ = isQuizzical
        ? 0.13
        : isUpbeat
          ? Math.sin(t * 5.2) * 0.055
          : isStartled
            ? Math.sin(t * 22) * 0.045
            : expr.speaking
              ? Math.sin(t * 6.5) * 0.028
              : 0;
      const targetNodX = isSleepy
        ? 0.075
        : expr.speaking
          ? Math.sin(t * 10.5) * 0.035
          : 0;
      expr.tiltZ += (targetTiltZ - expr.tiltZ) * 0.1;
      expr.nodX += (targetNodX - expr.nodX) * 0.12;
      wrap.rotation.z = expr.tiltZ;

      if (!interactiveOrbit && Number.isFinite(pointer.x)) {
        const { gl } = getThree();
        const rect = gl.domElement.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const tx = Math.max(-1, Math.min(1, (pointer.x - cx) / Math.max(220, window.innerWidth * 0.42)));
        const ty = Math.max(-1, Math.min(1, (pointer.y - cy) / Math.max(220, window.innerHeight * 0.42)));
        lookRef.current.x += (tx - lookRef.current.x) * 0.08;
        lookRef.current.y += (ty - lookRef.current.y) * 0.08;
        wrap.rotation.y = lookRef.current.x * 0.22 + Math.sin(t * 0.8) * 0.025;
        wrap.rotation.x = lookRef.current.y * 0.07 + expr.nodX;
      } else if (!interactiveOrbit) {
        wrap.rotation.x = expr.nodX;
      }

      // Live articulated hands & springy sprout leaves (zero allocations per frame)
      const limbs = limbsRef.current;
      if (limbs.armRight || limbs.armLeft || limbs.leaves) {
        const tapWave = tap >= 0 && tap < 0.95 ? Math.exp(-3.2 * tap) * Math.sin(tap * 13) : 0;
        const tapOpen = tap >= 0 && tap < 0.72 ? Math.sin((tap / 0.72) * Math.PI) : 0;

        // Thoughtful idle chin-tap cadence (gentle rhythmic hmm-taps + breathing)
        const thinkPulse = Math.pow(Math.max(0, Math.sin(t * 1.45)), 3);
        let tRx = -0.10 * thinkPulse - 0.03 * Math.sin(t * 2.1);
        let tRy = 0.04 * Math.sin(t * 0.9);
        let tRz = -0.05 * thinkPulse;
        let tLx = 0.03 * Math.sin(t * 1.7 + 0.6);
        let tLz = -0.05 * Math.sin(t * 1.9) - 0.04;
        let tSx = 0.025 * Math.sin(t * 2.1);
        let tSz = 0.035 * Math.sin(t * 1.6);

        if (isSleepy) {
          tRx = 0.06 + 0.02 * Math.sin(t * 1.0);
          tRy = 0.10;
          tRz = -0.02;
          tLz = 0.02 + 0.02 * Math.sin(t * 1.0);
          tSz = 0.02 * Math.sin(t * 0.9);
        } else if (isQuizzical) {
          tRx = -0.15 - 0.05 * Math.sin(t * 3.2);
          tRy = 0.02;
          tRz = -0.09;
          tSz = -0.08 + 0.03 * Math.sin(t * 2.5);
        } else if (isStartled) {
          tRx = -0.22;
          tRy = 0.32;
          tRz = -0.26;
          tLz = -0.34 + 0.08 * Math.sin(t * 20);
          tSz = 0.12 * Math.sin(t * 20);
        } else if (expr.speaking) {
          const talk = Math.sin(t * 7.8);
          const talkAbs = Math.abs(Math.sin(t * 5.2));
          tRx = -0.10 - 0.11 * talkAbs;
          tRy = 0.16 + 0.10 * talk;
          tRz = -0.14 - 0.09 * talkAbs;
          tLx = 0.05 * talk;
          tLz = -0.12 - 0.10 * talkAbs;
          tSx = 0.05 * talkAbs;
          tSz = 0.07 * talk;
        } else if (isUpbeat) {
          const cheer = Math.abs(Math.sin(t * 5.2));
          tRx = -0.16 - 0.10 * cheer;
          tRy = 0.24 + 0.10 * Math.sin(t * 5.2);
          tRz = -0.20 - 0.10 * cheer;
          tLz = -0.22 - 0.14 * cheer;
          tSz = 0.09 * Math.sin(t * 5.2);
        }

        // Pet / click cheer burst layered on top
        tRx -= 0.18 * tapOpen + 0.08 * tapWave;
        tRy += 0.30 * tapOpen;
        tRz -= 0.24 * tapOpen + 0.08 * tapWave;
        tLx -= 0.10 * tapOpen;
        tLz -= 0.30 * tapOpen + 0.10 * tapWave;
        tSx += 0.08 * tapWave;
        tSz -= 0.12 * tapWave;

        const c = limbs.cur;
        const k = 0.16;
        c.rx += (tRx - c.rx) * k;
        c.ry += (tRy - c.ry) * k;
        c.rz += (tRz - c.rz) * k;
        c.lx += (tLx - c.lx) * k;
        c.lz += (tLz - c.lz) * k;
        c.sx += (tSx - c.sx) * k;
        c.sz += (tSz - c.sz) * k;

        if (limbs.armRight) limbs.armRight.rotation.set(c.rx, c.ry, c.rz);
        if (limbs.armLeft) limbs.armLeft.rotation.set(c.lx, 0, c.lz);
        if (limbs.leaves) limbs.leaves.rotation.set(c.sx, 0, c.sz);
      }
    }

    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(onReady);
    }
  });

  return <group ref={worldRef} />;
}

export interface NogRigCanvasProps {
  scene: NogSceneName;
  active: boolean;
  stage?: NogStageSlug;
  species?: NogSpeciesId;
  tint?: string | null;
  equippedAccessories?: readonly (string | null)[];
  reaction?: NogReaction;
  tapCount?: number;
  mood?: string | null;
  speaking?: boolean;
  roomTheme?: NogRoomTheme;
  interactiveOrbit?: boolean;
  onReady: () => void;
  onFail: () => void;
  className?: string;
}

export default function NogRigCanvas({
  scene,
  active,
  stage,
  species,
  tint,
  equippedAccessories,
  reaction,
  tapCount,
  mood,
  speaking,
  roomTheme,
  interactiveOrbit,
  onReady,
  onFail,
  className,
}: NogRigCanvasProps) {
  const config = SCENE_POSTERS[scene];
  const glbEntry = resolveSceneGlb(scene, stage, species);
  const [loadedGlbState, setLoadedGlbState] = useState<{
    entry: GlbAssetEntry;
    asset: LoadedGlbAsset;
  } | null>(null);
  const [texture, setTexture] = useState<Texture | null>(null);
  const tintUniformRef = useRef({ value: new Vector3(1, 1, 1) });
  const activeGlbRef = useRef<LoadedGlbAsset | null>(null);
  const activeTexRef = useRef<Texture | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    const [r, g, b] = parseTintRgb(tint);
    tintUniformRef.current.value.set(r, g, b);
  }, [tint]);

  useEffect(() => {
    unmountedRef.current = false;
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => {
      unmountedRef.current = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      activeGlbRef.current?.dispose();
      activeGlbRef.current = null;
      activeTexRef.current?.dispose();
      activeTexRef.current = null;
    };
  }, []);

  // Load registered GLB model when present; swap in-place without unmounting <Canvas>
  useEffect(() => {
    let alive = true;

    const loadFallbackTexture = () =>
      new TextureLoader()
        .loadAsync(config.poster)
        .then((map) => {
          map.anisotropy = 4;
          map.premultiplyAlpha = true;
          map.needsUpdate = true;
          if (!alive) {
            map.dispose();
            return;
          }
          const prevTex = activeTexRef.current;
          activeTexRef.current = map;
          setTexture(map);
          prevTex?.dispose();
        })
        .catch(() => alive && onFail());

    if (glbEntry) {
      void loadNormalizedGlb(glbEntry, tintUniformRef.current).then((asset) => {
        if (!alive) {
          asset?.dispose();
          return;
        }
        if (asset) {
          const prevGlb = activeGlbRef.current;
          activeGlbRef.current = asset;
          setLoadedGlbState({ entry: glbEntry, asset });
          prevGlb?.dispose();
        } else {
          void loadFallbackTexture();
        }
      });
    } else {
      void loadFallbackTexture();
    }

    return () => {
      alive = false;
    };
  }, [config, glbEntry, onFail]);

  const glbAsset = loadedGlbState?.asset ?? null;
  const activeEntry = loadedGlbState?.entry ?? glbEntry;

  if (!glbAsset && !texture) return null;

  return (
    <Canvas
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        cursor: glbAsset && interactiveOrbit ? "grab" : "pointer",
      }}
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        powerPreference: glbAsset ? "high-performance" : "low-power",
        toneMapping: glbAsset ? ACESFilmicToneMapping : undefined,
        toneMappingExposure: 1.0,
      }}
      onCreated={({ gl }) => {
        if (glbAsset) {
          gl.outputColorSpace = SRGBColorSpace;
          gl.setClearColor(new Color(0x000000), 0);
        }
        gl.domElement.setAttribute("aria-hidden", "true");
        gl.domElement.addEventListener(
          "webglcontextlost",
          () => {
            if (!unmountedRef.current) onFail();
          },
          { once: true },
        );
      }}
    >
      {glbAsset && activeEntry ? (
        <GlbStudioScene
          entry={activeEntry}
          asset={glbAsset}
          equippedAccessories={equippedAccessories}
          reaction={reaction}
          tapCount={tapCount}
          mood={mood}
          speaking={speaking}
          roomTheme={roomTheme}
          interactiveOrbit={interactiveOrbit}
          onReady={onReady}
        />
      ) : texture ? (
        <RigidStudioCard
          config={config}
          texture={texture}
          tint={tint}
          reaction={reaction}
          onReady={onReady}
        />
      ) : null}
    </Canvas>
  );
}
