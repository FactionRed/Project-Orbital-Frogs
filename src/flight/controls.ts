// src/flight/controls.ts
import * as CANNON from 'cannon-es';
import type { Input } from '../core/input';
import type { FlightController } from './flight-controller';

const THROTTLE_RATE = 0.8; // per second
// Manual rotation torque, scaled by mass so heavier ships get proportionally
// more authority — and so SAS (also mass-scaled) can be overpowered when steering.
const TORQUE_PER_TONNE = 16;

export class FlightControls {
  /** Precision mode: halves torque for fine attitude adjustments. */
  precisionMode = false;

  constructor(private input: Input, private flight: FlightController) {
    input.onPressed('Space', () => this.stage());
    input.onPressed('KeyZ', () => {
      flight.throttle = 1;
    });
    input.onPressed('KeyX', () => {
      flight.throttle = 0;
    });
    input.onPressed('KeyT', () => {
      flight.sasEnabled = !flight.sasEnabled;
    });
    input.onPressed('CapsLock', () => {
      this.precisionMode = !this.precisionMode;
    });
  }

  /** Apply per-frame input: throttle ramp, rotation torque on root body. */
  update(dt: number): void {
    const inp = this.input;

    // F-key SAS override: while held, suppress SAS for manual input.
    flight_param: {
      this.flight.sasHeld = inp.isDown('KeyF');
    }

    if (inp.isDown('ShiftLeft'))
      this.flight.throttle = Math.min(1, this.flight.throttle + THROTTLE_RATE * dt);
    if (inp.isDown('ControlLeft'))
      this.flight.throttle = Math.max(0, this.flight.throttle - THROTTLE_RATE * dt);

    const root = this.flight.ship.rootBody;
    let torque = root.mass * TORQUE_PER_TONNE;
    if (this.precisionMode) torque *= 0.5;

    let tx = 0;
    let ty = 0;
    let tz = 0;
    if (inp.isDown('KeyW')) tx -= torque;
    if (inp.isDown('KeyS')) tx += torque;
    if (inp.isDown('KeyA')) ty += torque;
    if (inp.isDown('KeyD')) ty -= torque;
    if (inp.isDown('KeyQ')) tz += torque;
    if (inp.isDown('KeyE')) tz -= torque;
    if (tx || ty || tz) {
      const local = root.quaternion.vmult(new CANNON.Vec3(tx, ty, tz));
      root.torque.x += local.x;
      root.torque.y += local.y;
      root.torque.z += local.z;
    }
  }

  private stage(): void {
    this.flight.stage();
  }
}
