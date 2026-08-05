// tools/preview-parts.entry.ts
//
// Browser half of the model preview. Bundled by tools/preview-parts.mjs and
// run in a headless Chromium; it draws into #c and then sets window.__done so
// the driver knows when to screenshot.
//
// Two modes, selected by window.__PREVIEW_MODE:
//   'parts' — every catalog part in its own cell, three-quarter view
//   'stack' — an assembled two-stage rocket, so the joins can be checked
import * as THREE from 'three';
import { buildPartMesh } from '../src/rendering/part-models';
import { PARTS_CATALOG, getPartDef } from '../src/entities/parts-catalog';

declare global {
  interface Window {
    __PREVIEW_MODE?: 'parts' | 'stack';
    __done?: boolean;
    __stats?: Array<{ id: string; tris: number }>;
  }
}

const CELL = 320;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);

// Three-point lighting. The game lights parts differently, but form reads far
// better under a key/fill/rim setup, which is what this view is for.
scene.add(new THREE.AmbientLight(0x8899bb, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 6, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.7);
fill.position.set(-5, 1, 3);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffddaa, 1.0);
rim.position.set(-2, 3, -6);
scene.add(rim);

/** Point the camera at an object and back off far enough to frame it. */
function frame(camera: THREE.PerspectiveCamera, object: THREE.Object3D, margin: number): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 180 / 2)) * margin;
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0.7, 0.35, 1).normalize(), dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function renderParts(): void {
  const cols = PARTS_CATALOG.length;
  canvas.width = CELL * cols;
  canvas.height = CELL;
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setScissorTest(true);

  const holder = new THREE.Group();
  scene.add(holder);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  PARTS_CATALOG.forEach((def, i) => {
    holder.clear();
    holder.add(buildPartMesh(def));
    frame(camera, holder, 1.35);
    const x = i * CELL;
    renderer.setViewport(x, 0, CELL, CELL);
    renderer.setScissor(x, 0, CELL, CELL);
    renderer.render(scene, camera);
  });
}

function renderStack(): void {
  const W = 900;
  const H = 640;
  canvas.width = W;
  canvas.height = H;
  renderer.setSize(W, H, false);
  renderer.setScissorTest(false);

  // Stack downward from the pod, node to node, the way the VAB snaps parts:
  // a child's top node lands on its parent's bottom node.
  const group = new THREE.Group();
  let y = 0;
  const place = (id: string, topNode: number, bottomNode: number): number => {
    y -= topNode;
    const mesh = buildPartMesh(getPartDef(id));
    mesh.position.y = y;
    group.add(mesh);
    const placedAt = y;
    y -= bottomNode;
    return placedAt;
  };
  place('pod', 0, 1.2);
  place('tank', 2.5, 2.5);
  place('strut', 2.0, 2.0);
  const lowerTank = place('tank', 2.5, 2.5);
  place('engine', 1.0, 1.0);

  // A pair of fins on the flank of the lower tank.
  for (const sx of [-1, 1]) {
    const w = buildPartMesh(getPartDef('winglet'));
    w.position.set(sx * 3.4, lowerTank - 1.2, 0);
    if (sx < 0) w.rotation.y = Math.PI;
    group.add(w);
  }
  scene.add(group);

  const camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 200);
  frame(camera, group, 1.06);
  renderer.render(scene, camera);
}

if (window.__PREVIEW_MODE === 'stack') renderStack();
else renderParts();

// Triangle counts per part, so the cost of a resolution change is visible.
window.__stats = PARTS_CATALOG.map((def) => ({
  id: def.id,
  tris: (buildPartMesh(def).geometry.index?.count ?? 0) / 3,
}));
window.__done = true;
