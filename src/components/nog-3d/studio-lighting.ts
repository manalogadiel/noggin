import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  Vector3,
  type WebGLRenderer,
} from "three";
import type { NogRoomTheme } from "./nog-stage";

export interface RoomLightPreset {
  keyColor: number;
  keyIntensity: number;
  fillColor: number;
  fillIntensity: number;
  rimColor: number;
  rimIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  envIntensity: number;
}

export const ROOM_LIGHT_PRESETS: Record<NogRoomTheme, RoomLightPreset> = {
  day: {
    keyColor: 0xfff8ec,
    keyIntensity: 1.9,
    fillColor: 0xe6f0ff,
    fillIntensity: 0.45,
    rimColor: 0xfff2dc,
    rimIntensity: 0.58,
    hemiSky: 0xf8fbff,
    hemiGround: 0xc8baaa,
    hemiIntensity: 0.92,
    envIntensity: 0.52,
  },
  minimal: {
    keyColor: 0xffffff,
    keyIntensity: 1.85,
    fillColor: 0xf0f4fa,
    fillIntensity: 0.5,
    rimColor: 0xffffff,
    rimIntensity: 0.55,
    hemiSky: 0xffffff,
    hemiGround: 0xd2cbc2,
    hemiIntensity: 0.95,
    envIntensity: 0.54,
  },
  greenhouse: {
    keyColor: 0xf8ffeb,
    keyIntensity: 1.9,
    fillColor: 0xdcf2d8,
    fillIntensity: 0.48,
    rimColor: 0xe4ffb8,
    rimIntensity: 0.65,
    hemiSky: 0xf2ffec,
    hemiGround: 0xa2bc85,
    hemiIntensity: 0.94,
    envIntensity: 0.5,
  },
  treehouse: {
    keyColor: 0xffebd0,
    keyIntensity: 1.95,
    fillColor: 0xe3ecd4,
    fillIntensity: 0.44,
    rimColor: 0xffdba0,
    rimIntensity: 0.68,
    hemiSky: 0xfff6e8,
    hemiGround: 0xbaa07f,
    hemiIntensity: 0.9,
    envIntensity: 0.48,
  },
  night: {
    keyColor: 0xffdca8,
    keyIntensity: 1.65,
    fillColor: 0x839ede,
    fillIntensity: 0.62,
    rimColor: 0x9bc0ff,
    rimIntensity: 1.1,
    hemiSky: 0x90a8e2,
    hemiGround: 0x4b536e,
    hemiIntensity: 0.8,
    envIntensity: 0.44,
  },
};

export function parseTintRgb(tint?: string | null): [number, number, number] {
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

/**
 * Bakes a bright softbox studio reflection environment via PMREMGenerator so
 * glossy eyes and satin clay highlights catch crisp studio reflections without
 * downloading an external HDRI file.
 */
export function createStudioEnvironment(renderer: WebGLRenderer): {
  texture: Texture;
  dispose: () => void;
} {
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();

  const domeGeo = new SphereGeometry(18, 24, 16);
  const domeMat = new MeshBasicMaterial({ color: 0xe6e0d6, side: BackSide });
  envScene.add(new Mesh(domeGeo, domeMat));

  const keyPanelGeo = new CircleGeometry(2.0, 32);
  const keyPanelMat = new MeshBasicMaterial({ color: new Color(4.2, 4.2, 4.1) });
  const keyPanel = new Mesh(keyPanelGeo, keyPanelMat);
  keyPanel.position.set(-4.0, 5.2, 6.8);
  keyPanel.lookAt(0, 0, 0);
  envScene.add(keyPanel);

  const rimPanelGeo = new CircleGeometry(0.95, 24);
  const rimPanelMat = new MeshBasicMaterial({ color: new Color(2.1, 2.15, 2.25) });
  const rimPanel = new Mesh(rimPanelGeo, rimPanelMat);
  rimPanel.position.set(5.4, 2.4, 5.4);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  const ceilGeo = new BoxGeometry(12, 0.3, 12);
  const ceilMat = new MeshBasicMaterial({ color: 0xfff8ee });
  const ceil = new Mesh(ceilGeo, ceilMat);
  ceil.position.set(0, 9.5, 0);
  envScene.add(ceil);

  const floorGeo = new BoxGeometry(16, 0.3, 16);
  const floorMat = new MeshBasicMaterial({ color: 0xd4c8b8 });
  const floor = new Mesh(floorGeo, floorMat);
  floor.position.set(0, -6.5, 0);
  envScene.add(floor);

  const rt = pmrem.fromScene(envScene, 0.032);

  domeGeo.dispose();
  domeMat.dispose();
  keyPanelGeo.dispose();
  keyPanelMat.dispose();
  rimPanelGeo.dispose();
  rimPanelMat.dispose();
  ceilGeo.dispose();
  ceilMat.dispose();
  floorGeo.dispose();
  floorMat.dispose();
  pmrem.dispose();

  return {
    texture: rt.texture,
    dispose: () => rt.dispose(),
  };
}

export function createContactShadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 122);
    grad.addColorStop(0, "rgba(56, 46, 38, 0.32)");
    grad.addColorStop(0.45, "rgba(56, 46, 38, 0.14)");
    grad.addColorStop(0.8, "rgba(56, 46, 38, 0.03)");
    grad.addColorStop(1, "rgba(56, 46, 38, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface ClayTintUniform {
  value: Vector3;
}

/**
 * Patches a loaded GLB PBR material so skin color tints recolor the clay body while
 * preserving baked ambient occlusion, dark glossy eyes/mouth, and green sprout leaves.
 */
export function attachSmartClayTint(
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  tintUniform: ClayTintUniform,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNogTint = tintUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uNogTint;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float nogLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float isLeaf = smoothstep(1.06, 1.18, diffuseColor.g / max(0.001, max(diffuseColor.r, diffuseColor.b)));
        float isDarkFeature = 1.0 - smoothstep(0.14, 0.28, nogLuma);
        float bodyMask = (1.0 - isLeaf) * (1.0 - isDarkFeature);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uNogTint, bodyMask);`,
      );
  };
  material.customProgramCacheKey = () => "nog-smart-clay-tint-v1";
  material.needsUpdate = true;
}

export function tintToColor(tint?: string | null): Color {
  const [r, g, b] = parseTintRgb(tint);
  return new Color(r, g, b);
}
