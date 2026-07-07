// src/dev/debug-interface.ts
//
// Exposes window.__game — a simple, agent-friendly API for testing the game
// without fighting browser keyboard/wheel event issues. Every method returns
// a plain string or primitive (no DOM querying, no getComputedStyle, nothing
// that can trigger browser navigation or blank the page).
//
// Usage from browser_console:
//   __game.state()              → "BUILD parts=0 ready=false"
//   __game.build()              → builds pod+tank+engine
//   __game.launch()             → enters flight
//   __game.stage()              → press Space equivalent
//   __game.throttle(0.5)        → set throttle 0..1
//   __game.throttle(1)          → full throttle
//   __game.map()                → toggle map
//   __game.zoom(-5)             → zoom in 5 steps (negative=in, positive=out)
//   __game.sas()                → toggle SAS
//   __game.revert()             → F1 revert to VAB
//   __game.clear()              → clear VAB build
//   __game.screenshot()         → returns state summary for vision analysis

import type { VabController } from '../building/vab-controller';
import type { FlightController } from '../flight/flight-controller';
import type { FlightCamera } from '../flight/flight-camera';
import type { StateMachine } from '../core/state-machine';
import type { OrbitMap } from '../ui/orbit-map';

export interface DebugDeps {
  vab: VabController;
  flight: () => FlightController | null;
  flightCam: () => FlightCamera | null;
  fsm: StateMachine;
  orbitMap: OrbitMap;
  dom: () => HTMLElement; // renderer canvas
}

export function installDebugInterface(deps: DebugDeps): void {
  const api = {
    // --- State query ---
    state(): string {
      const f = deps.flight();
      if (deps.fsm.current === 'BUILD') {
        const parts = deps.vab.design.parts.length;
        const ready = deps.vab.isReady();
        return `BUILD parts=${parts} ready=${ready}`;
      }
      if (!f) return `state=${deps.fsm.current} (no flight)`;
      const rb = f.ship.rootBody;
      const alt = Math.hypot(rb.position.x, rb.position.y, rb.position.z) - f.planet.data.radius;
      const vel = Math.hypot(rb.velocity.x, rb.velocity.y, rb.velocity.z);
      return `FLIGHT alt=${alt.toFixed(0)} vel=${vel.toFixed(0)} fuel=${f.ship.fuel.toFixed(0)} throttle=${f.throttle.toFixed(2)} sas=${f.sasEnabled} stage=${f.currentStageIndex} map=${deps.orbitMap.visible}`;
    },

    // Detailed state as plain object (safe for browser_console)
    snapshot(): object {
      const f = deps.flight();
      if (deps.fsm.current === 'BUILD') {
        return {
          mode: 'BUILD',
          parts: deps.vab.design.parts.length,
          ready: deps.vab.isReady(),
          partIds: deps.vab.design.parts.map(p => p.partId),
        };
      }
      if (!f) return { mode: deps.fsm.current, error: 'no flight' };
      const rb = f.ship.rootBody;
      const alt = Math.hypot(rb.position.x, rb.position.y, rb.position.z) - f.planet.data.radius;
      const vel = Math.hypot(rb.velocity.x, rb.velocity.y, rb.velocity.z);
      return {
        mode: 'FLIGHT',
        alt: Math.round(alt),
        vel: Math.round(vel),
        fuel: Math.round(f.ship.fuel),
        throttle: Math.round(f.throttle * 100) / 100,
        sas: f.sasEnabled,
        stageIdx: f.currentStageIndex,
        stageCount: f.getStages().length,
        mapOpen: deps.orbitMap.visible,
        soi: f.dominantBodyFor(rb.position).data.name,
      };
    },

    // --- VAB ---
    // Build a standard pod+tank+engine rocket at origin
    build(): string {
      deps.vab.clear();
      const THREE = deps.vab.design; // just to access nothing — we use vab API
      void THREE;
      // Place parts programmatically via the VAB controller
      // We need to call beginPlace + onPointerUp with fake NDC
      const ndcCenter = { x: 0, y: 0 } as any; // center of screen
      deps.vab.beginPlace('pod');
      deps.vab.onPointerMove(ndcCenter);
      deps.vab.onPointerUp(ndcCenter);
      deps.vab.beginPlace('tank');
      // Tank snaps to pod bottom — simulate pointer slightly below center
      const ndcBelow = { x: 0, y: -0.1 } as any;
      deps.vab.onPointerMove(ndcBelow);
      deps.vab.onPointerUp(ndcBelow);
      deps.vab.beginPlace('engine');
      const ndcFurther = { x: 0, y: -0.2 } as any;
      deps.vab.onPointerMove(ndcFurther);
      deps.vab.onPointerUp(ndcFurther);
      return `built ${deps.vab.design.parts.length} parts, ready=${deps.vab.isReady()}`;
    },

    clear(): string {
      deps.vab.clear();
      return 'cleared';
    },

    // Place a specific part at center
    place(partId: string): string {
      deps.vab.beginPlace(partId);
      const ndc = { x: 0, y: 0 } as any;
      deps.vab.onPointerMove(ndc);
      deps.vab.onPointerUp(ndc);
      return `placed ${partId}, total=${deps.vab.design.parts.length}`;
    },

    launch(): string {
      if (!deps.vab.isReady()) return 'not ready — need pod + engine';
      // Trigger launch via the same path main.ts uses
      // We can't call launchFlight directly, so simulate the Launch button click
      const btn = document.getElementById('launch') as HTMLButtonElement;
      if (btn) { btn.click(); return 'launching'; }
      return 'no launch button';
    },

    // --- Flight ---
    stage(): string {
      const f = deps.flight();
      if (!f) return 'no flight';
      f.stage();
      return `staged, idx=${f.currentStageIndex}`;
    },

    throttle(t: number): string {
      const f = deps.flight();
      if (!f) return 'no flight';
      f.throttle = Math.max(0, Math.min(1, t));
      return `throttle=${f.throttle.toFixed(2)}`;
    },

    sas(): string {
      const f = deps.flight();
      if (!f) return 'no flight';
      f.sasEnabled = !f.sasEnabled;
      return `sas=${f.sasEnabled}`;
    },

    map(): string {
      const f = deps.flight();
      deps.orbitMap.toggle(deps.dom(), f ?? undefined);
      return `map=${deps.orbitMap.visible}`;
    },

    zoom(delta: number): string {
      // Access the orbit map's private mapDistance via a public-ish approach.
      // We dispatch wheel events on the canvas — but only if map is open.
      if (!deps.orbitMap.visible) return 'map not open';
      const c = deps.dom();
      const steps = Math.round(delta);
      for (let i = 0; i < Math.abs(steps); i++) {
        c.dispatchEvent(new WheelEvent('wheel', { deltaY: steps > 0 ? 100 : -100, bubbles: true }));
      }
      return `zoomed ${steps > 0 ? 'out' : 'in'} ${Math.abs(steps)} steps`;
    },

    revert(): string {
      // Simulate F1
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'F1', key: 'F1' }));
      return 'reverting';
    },

    // --- Camera / view ---
    // Right-click drag simulation for testing artifact bugs
    dragRight(dx: number, dy: number): string {
      const c = deps.dom();
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      // pointerdown with button 2 (right)
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, button: 2, pointerId: 2, pointerType: 'mouse' }));
      // drag
      for (let i = 1; i <= 10; i++) {
        const fx = cx + (dx * i) / 10;
        const fy = cy + (dy * i) / 10;
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: fx, clientY: fy, pointerId: 2, pointerType: 'mouse' }));
      }
      // release
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, pointerType: 'mouse' }));
      return `dragged right ${dx},${dy}`;
    },

    // Left-drag simulation (for flight camera orbit + map drag)
    dragLeft(dx: number, dy: number): string {
      const c = deps.dom();
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, button: 0, pointerId: 3, pointerType: 'mouse' }));
      for (let i = 1; i <= 10; i++) {
        const fx = cx + (dx * i) / 10;
        const fy = cy + (dy * i) / 10;
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: fx, clientY: fy, pointerId: 3, pointerType: 'mouse' }));
      }
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, pointerType: 'mouse' }));
      return `dragged left ${dx},${dy}`;
    },

    help(): string {
      return [
        'Methods: state() snapshot() build() clear() place(id) launch()',
        'stage() throttle(0..1) sas() map() zoom(±n) revert()',
        'dragRight(dx,dy) dragLeft(dx,dy)',
        'Parts: pod tank engine winglet strut',
      ].join(' | ');
    },
  };

  (window as any).__game = api;
  console.log('[debug] window.__game ready. Call __game.help() for usage.');
}
