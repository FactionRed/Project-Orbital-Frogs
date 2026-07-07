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
 * The crash site is placed on the moon's equator (not the pole) so the
 * terrain has visible features and the horizon curves away naturally.
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
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 20000);
    this.ambient = new THREE.AmbientLight(0x303048, 0.5);
    this.sun = new THREE.DirectionalLight(0xffeecc, 1.8);
    this.sun.position.set(200, 300, 100);

    this.group.add(this.ambient);
    this.group.add(this.sun);
    this.buildScene();
    this.updateCamera();
  }

  private buildScene(): void {
    // --- Moon surface ---
    const moonRadius = 400;
    const moon = buildProceduralBody({
      radius: moonRadius,
      seed: 42,
      kind: 'moon',
      sunDirection: new THREE.Vector3(1, 0.5, 0.3),
    });
    this.group.add(moon.surface);

    // Place the crash site on the equator at +X.
    // Surface point: (moonRadius, 0, 0). "Up" is +X direction.
    const surfacePoint = new THREE.Vector3(moonRadius, 0, 0);
    const up = surfacePoint.clone().normalize(); // (1, 0, 0)

    // Build a local frame: up = radial, forward = +Z, right = up × forward
    const forward = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    forward.crossVectors(right, up).normalize();

    // --- Crashed rocket debris ---
    // Scatter parts in the local tangent plane around the crash site.
    const partIds = ['pod', 'tank', 'engine', 'tank', 'strut', 'winglet', 'engine'];
    const scatter: { fwd: number; right: number; ry: number; scale: number; tilt: number }[] = [
      { fwd: 0,  right: 0,  ry: 0.3,  scale: 1.2, tilt: 0.2 },   // pod — main wreck, tilted
      { fwd: 5,  right: 3,  ry: 1.2,  scale: 1.0, tilt: 0.5 },   // tank — rolled away
      { fwd: -4, right: 4,  ry: -0.8, scale: 0.9, tilt: 0.3 },   // engine — detached
      { fwd: 8,  right: -2, ry: 2.1,  scale: 0.7, tilt: 0.6 },   // second tank fragment
      { fwd: -6, right: -3, ry: 0.7,  scale: 0.6, tilt: 0.4 },   // strut piece
      { fwd: 3,  right: 6,  ry: -1.5, scale: 0.8, tilt: 0.1 },   // winglet
      { fwd: -3, right: -5, ry: 1.8,  scale: 0.5, tilt: 0.7 },   // small engine piece
    ];

    for (let i = 0; i < partIds.length; i++) {
      const def = getPartDef(partIds[i]);
      const mesh = buildPartMesh(def);
      const s = scatter[i];

      // Position on the tangent plane: surfacePoint + right*s.right + forward*s.fwd + up*offset
      const pos = surfacePoint.clone()
        .addScaledVector(right, s.right)
        .addScaledVector(forward, s.fwd)
        .addScaledVector(up, 0.5); // lift slightly above surface
      mesh.position.copy(pos);

      // Orient the part so its Y axis aligns with the local "up" (radial).
      const upQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        up,
      );
      mesh.quaternion.copy(upQuat);
      // Apply tilt and rotation around local up.
      mesh.rotateOnAxis(up, s.ry);
      mesh.rotateOnAxis(right, s.tilt);

      mesh.scale.multiplyScalar(s.scale);
      this.group.add(mesh);
      this.debris.push(mesh);
    }

    // --- Stars ---
    const starGeom = new THREE.BufferGeometry();
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8000;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const brightness = 0.3 + Math.random() * 0.7;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness * 1.1;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      sizeAttenuation: false,
    });
    const stars = new THREE.Points(starGeom, starMat);
    this.group.add(stars);

    // --- Distant planet (Terra) in the sky ---
    const planetGeom = new THREE.SphereGeometry(120, 32, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x336699,
      emissive: 0x112244,
      emissiveIntensity: 0.4,
      roughness: 0.7,
    });
    const planet = new THREE.Mesh(planetGeom, planetMat);
    // Place high in the sky, opposite the sun.
    planet.position.copy(surfacePoint).addScaledVector(up, 800).addScaledVector(forward, -600);
    this.group.add(planet);

    // Atmosphere glow around the distant planet
    const atmoGeom = new THREE.SphereGeometry(170, 32, 24);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const atmo = new THREE.Mesh(atmoGeom, atmoMat);
    atmo.position.copy(planet.position);
    this.group.add(atmo);

    // Store camera anchor info.
    this._surfacePoint = surfacePoint;
    this._up = up;
    this._right = right;
    this._forward = forward;
  }

  private _surfacePoint = new THREE.Vector3();
  private _up = new THREE.Vector3(1, 0, 0);
  private _right = new THREE.Vector3();
  private _forward = new THREE.Vector3();

  private updateCamera(): void {
    // Camera orbits around the crash site on the tangent plane.
    // Distance ~18, height ~5 above surface, looking at the center of the debris.
    const radius = 18;
    const height = 5;
    const angle = this.time * 0.08; // slow cinematic orbit

    const camPos = this._surfacePoint.clone()
      .addScaledVector(this._right, Math.cos(angle) * radius)
      .addScaledVector(this._forward, Math.sin(angle) * radius)
      .addScaledVector(this._up, height);
    this.camera.position.copy(camPos);

    // Look at a point slightly above the crash site center.
    const lookAt = this._surfacePoint.clone().addScaledVector(this._up, 1.5);
    this.camera.lookAt(lookAt);

    // Camera "up" = the radial up so the horizon looks correct.
    this.camera.up.copy(this._up);
  }

  update(dt: number): void {
    this.time += dt;
    this.updateCamera();

    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      d.rotateOnAxis(this._up, Math.sin(this.time * 0.3 + i) * 0.0002);
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
