// src/ui/menu-scene.ts
import * as THREE from 'three';
import { buildProceduralBody } from '../rendering/procedural-planet';
import { buildPartMesh } from '../rendering/part-models';
import { getPartDef } from '../entities/parts-catalog';

/**
 * 3D main menu background scene — a crashed rocket scattered on the moon's
 * surface. Uses the same voxel part models and procedural planet renderer as
 * the game itself, so the menu feels like a natural extension of the game.
 *
 * The scene slowly rotates the camera for a cinematic feel. It's purely
 * decorative — no physics, no input.
 */
export class MenuScene {
  readonly group: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private time = 0;
  private debris: THREE.Object3D[] = [];

  constructor(aspect: number) {
    this.group = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.5, 20000);
    this.ambient = new THREE.AmbientLight(0x303048, 0.6);
    this.sun = new THREE.DirectionalLight(0xffeecc, 1.5);
    this.sun.position.set(200, 100, 150);

    this.group.add(this.ambient);
    this.group.add(this.sun);
    this.buildScene();
    this.updateCamera();
  }

  private buildScene(): void {
    // --- Moon surface ---
    const moon = buildProceduralBody({
      radius: 800,
      seed: 42,
      kind: 'moon',
      sunDirection: new THREE.Vector3(1, 0.3, 0.6),
    });
    this.group.add(moon.surface);

    // Place the camera at the surface, looking out across the terrain.
    // The moon center is at origin; north pole is at (0, 800, 0).
    // We'll put the crash site near the north pole so the terrain is flat-ish.

    // --- Crashed rocket debris ---
    // Scatter voxel parts around the crash site with random rotations.
    const crashY = 800; // moon surface at north pole
    const partIds = ['pod', 'tank', 'engine', 'tank', 'strut', 'winglet', 'engine'];
    const scatter: { x: number; z: number; ry: number; scale: number }[] = [
      { x: 0,    z: -8,  ry: 0.3,  scale: 1.0 },   // pod — main wreck
      { x: 6,    z: 3,   ry: 1.2,  scale: 0.9 },   // tank — rolled away
      { x: -5,   z: 5,   ry: -0.8, scale: 0.85 },  // engine — detached
      { x: 10,   z: -2,  ry: 2.1,  scale: 0.7 },   // second tank fragment
      { x: -8,   z: -3,  ry: 0.7,  scale: 0.6 },   // strut piece
      { x: 3,    z: 8,   ry: -1.5, scale: 0.8 },   // winglet
      { x: -3,   z: -6,  ry: 1.8,  scale: 0.5 },   // small engine piece
    ];

    for (let i = 0; i < partIds.length; i++) {
      const def = getPartDef(partIds[i]);
      const mesh = buildPartMesh(def);
      const s = scatter[i];
      mesh.position.set(s.x, crashY + 1, s.z);
      mesh.rotation.y = s.ry;
      mesh.rotation.x = (Math.random() - 0.5) * 0.4;
      mesh.rotation.z = (Math.random() - 0.5) * 0.4;
      mesh.scale.multiplyScalar(s.scale);
      this.group.add(mesh);
      this.debris.push(mesh);
    }

    // --- Crater scorch marks (dark decals) ---
    const scorchGeom = new THREE.CircleGeometry(12, 24);
    const scorchMat = new THREE.MeshBasicMaterial({
      color: 0x221111,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const scorch = new THREE.Mesh(scorchGeom, scorchMat.clone());
      const angle = (i / 3) * Math.PI * 2;
      const r = 5 + i * 4;
      scorch.position.set(Math.cos(angle) * r, crashY + 0.1, Math.sin(angle) * r);
      scorch.rotation.x = -Math.PI / 2;
      (scorch.material as THREE.MeshBasicMaterial).opacity = 0.4 - i * 0.1;
      this.group.add(scorch);
    }

    // --- Stars ---
    const starGeom = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Random points on a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5000;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // Vary brightness
      const brightness = 0.3 + Math.random() * 0.7;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness * 1.1;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      sizeAttenuation: false,
    });
    const stars = new THREE.Points(starGeom, starMat);
    this.group.add(stars);

    // --- Distant planet (Terra) in the sky ---
    const planetGeom = new THREE.SphereGeometry(200, 32, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x336699,
      emissive: 0x112244,
      emissiveIntensity: 0.3,
      roughness: 0.8,
    });
    const planet = new THREE.Mesh(planetGeom, planetMat);
    planet.position.set(800, 1200, -2000);
    this.group.add(planet);

    // Atmosphere glow around the distant planet
    const atmoGeom = new THREE.SphereGeometry(280, 32, 24);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const atmo = new THREE.Mesh(atmoGeom, atmoMat);
    atmo.position.copy(planet.position);
    this.group.add(atmo);
  }

  private updateCamera(): void {
    // Camera sits low on the moon surface, looking across the crash site.
    const surfaceY = 800;
    const radius = 25;
    const angle = this.time * 0.08; // slow cinematic orbit — ~80s per revolution
    this.camera.position.set(
      Math.cos(angle) * radius,
      surfaceY + 6,
      Math.sin(angle) * radius,
    );
    this.camera.lookAt(0, surfaceY + 2, 0);
  }

  /** Advance the scene by dt seconds. */
  update(dt: number): void {
    this.time += dt;
    this.updateCamera();

    // Subtle debris sway (wind effect on a dead world — eerie)
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      d.rotation.z += Math.sin(this.time * 0.5 + i) * 0.0003;
    }
  }

  get cameraObject(): THREE.PerspectiveCamera {
    return this.camera;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
