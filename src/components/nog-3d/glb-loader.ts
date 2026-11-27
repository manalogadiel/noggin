import {
  AnimationClip,
  Box3,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { GlbAssetEntry } from "./model-manifest";
import { attachSmartClayTint, type ClayTintUniform } from "./studio-lighting";

export interface LoadedGlbAsset {
  root: Group;
  animations: AnimationClip[];
  dispose: () => void;
}

interface CachedTemplate {
  scene: Group;
  animations: AnimationClip[];
}

const templateCache = new Map<string, Promise<CachedTemplate | null>>();
let sharedLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    sharedLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return sharedLoader;
}

function loadTemplate(url: string): Promise<CachedTemplate | null> {
  let pending = templateCache.get(url);
  if (!pending) {
    pending = Promise.resolve(MeshoptDecoder.ready)
      .then(() => getLoader().loadAsync(url))
      .then((gltf) => ({
        scene: gltf.scene,
        animations: gltf.animations ?? [],
      }))
      .catch(() => null);
    templateCache.set(url, pending);
  }
  return pending;
}

/**
 * Loads, clones, grounds (`y = 0`), normalizes height, and prepares a `.glb` asset
 * for studio lighting and optional smart clay-body tinting.
 */
export async function loadNormalizedGlb(
  entry: GlbAssetEntry,
  tintUniform?: ClayTintUniform,
): Promise<LoadedGlbAsset | null> {
  const tpl = await loadTemplate(entry.url);
  if (!tpl) return null;

  const root = new Group();
  const model = tpl.scene.clone(true);
  if (entry.rotationY) model.rotation.y = entry.rotationY;

  const clonedMaterials: Array<{ dispose: () => void }> = [];

  model.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const swapMat = (mat: unknown) => {
      if (mat instanceof MeshStandardMaterial || mat instanceof MeshPhysicalMaterial) {
        const cloned = mat.clone();
        if (cloned.name === "nog_glossy_eye") {
          cloned.envMapIntensity = 0.42;
        }
        if (entry.smartTint !== false && tintUniform) {
          attachSmartClayTint(cloned, tintUniform);
        }
        clonedMaterials.push(cloned);
        return cloned;
      }
      return mat;
    };
    if (Array.isArray(node.material)) {
      node.material = node.material.map(swapMat);
    } else if (node.material) {
      node.material = swapMat(node.material);
    }
  });

  if (entry.rawScale !== undefined) {
    model.scale.setScalar(entry.rawScale);
  } else {
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const targetHeight = entry.targetHeight ?? 1.25;
    const maxDim = Math.max(size.y, size.x * 0.75, 1e-4);
    const scale = targetHeight / maxDim;
    model.scale.setScalar(scale);
    model.position.set(
      -center.x * scale,
      -box.min.y * scale + (entry.yOffset ?? 0),
      -center.z * scale,
    );
  }

  root.add(model);

  return {
    root,
    animations: tpl.animations,
    dispose: () => {
      clonedMaterials.forEach((m) => m.dispose());
    },
  };
}
