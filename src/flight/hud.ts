// src/flight/hud.ts
import type { FlightController } from './flight-controller';
import { orbitalEnergy, apoapsisPeriapsis } from '../physics/orbit-math';
import { MOON_SOI, ATMOSPHERE } from '../physics/constants';
import { Panel, Readout, Gauge } from '../ui/components';

/** Dynamic pressure above this (kPa) is the "stop accelerating" signal. */
const Q_ALARM = 200;
/** Fuel fraction below this raises a caution. */
const FUEL_CAUTION = 0.2;

export class Hud {
  private root: HTMLElement;
  private throttle: Gauge;
  private fuelGauge: Gauge;
  private altitude: Readout;
  private velocity: Readout;
  private apoapsis: Readout;
  private periapsis: Readout;
  private q: Readout;
  private soi: Readout;
  private sas: Readout;
  private precisionLamp: HTMLElement;
  /** Tank capacity of the current vessel; -1 until the first update. */
  private maxFuel = -1;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Telemetry');

    const panel = new Panel('TELEMETRY');

    this.throttle = new Gauge('bar');
    this.fuelGauge = new Gauge('bar');
    panel.el.append(
      gaugeRow('THR', this.throttle),
      gaugeRow('FUEL', this.fuelGauge),
    );

    this.altitude = new Readout('ALT', 'm');
    this.velocity = new Readout('VEL', 'm/s');
    this.apoapsis = new Readout('Ap', 'm');
    this.periapsis = new Readout('Pe', 'm');
    this.q = new Readout('Q', 'kPa');
    this.soi = new Readout('SOI');
    this.sas = new Readout('SAS');
    // SOI and SAS carry words, not numbers — the 32px instrument face would
    // wrap the panel, so they render at body size.
    this.soi.el.classList.add('readout--compact');
    this.sas.el.classList.add('readout--compact');

    // Precision-steering lamp. It lives in the panel rather than floating in a
    // corner of its own: at 900px every corner is already taken.
    this.precisionLamp = document.createElement('div');
    this.precisionLamp.id = 'precision-indicator';
    this.precisionLamp.textContent = 'PRECISION';
    this.precisionLamp.style.display = 'none';

    panel.el.append(
      this.altitude.el, this.velocity.el, this.apoapsis.el, this.periapsis.el,
      this.q.el, this.soi.el, this.sas.el, this.precisionLamp,
    );

    this.root.appendChild(panel.el);
    document.body.appendChild(this.root);
  }

  /** Forget the previous vessel's tank capacity. Call when a flight starts. */
  resetMaxFuel(): void {
    this.maxFuel = -1;
  }

  /** Light the PRECISION lamp while CapsLock fine-steering is engaged. */
  setPrecision(on: boolean): void {
    this.precisionLamp.style.display = on ? 'block' : 'none';
  }

  update(flight: FlightController): void {
    const root = flight.ship.rootBody;
    // Use the dominant celestial body (planet or moon) so Ap/Pe and altitude
    // are correct when inside Luna's sphere of influence.
    const dom = flight.dominantBodyFor(root.position);
    const domPos = dom.position;
    const dx = root.position.x - domPos.x;
    const dy = root.position.y - domPos.y;
    const dz = root.position.z - domPos.z;
    const alt = Math.hypot(dx, dy, dz) - dom.data.radius;
    const vel = Math.hypot(root.velocity.x, root.velocity.y, root.velocity.z);

    this.altitude.setValue(alt.toFixed(0));
    this.velocity.setValue(vel.toFixed(0));

    const r: [number, number, number] = [dx, dy, dz];
    const v: [number, number, number] = [root.velocity.x, root.velocity.y, root.velocity.z];
    const mu = dom.mu;
    if (orbitalEnergy(r, v, mu) < 0) {
      const { apoapsis, periapsis } = apoapsisPeriapsis(r, v, mu);
      this.apoapsis.setValue((apoapsis - dom.data.radius).toFixed(0));
      this.periapsis.setValue((periapsis - dom.data.radius).toFixed(0));
      this.apoapsis.setState('nominal');
      this.periapsis.setState('nominal');
    } else {
      // Hyperbolic: no apsides to show.
      this.apoapsis.setValue('ESC');
      this.periapsis.setValue('ESC');
      this.apoapsis.setState('caution');
      this.periapsis.setState('caution');
    }

    // Fuel as a fraction of what this vessel launched with, so the bar means
    // something regardless of how many tanks the player bolted on.
    if (this.maxFuel < 0) this.maxFuel = flight.ship.fuel;
    const fuelFrac = this.maxFuel > 0 ? flight.ship.fuel / this.maxFuel : 0;
    this.fuelGauge.setFraction(fuelFrac, `${flight.ship.fuel.toFixed(0)} / ${this.maxFuel.toFixed(0)}`);
    this.fuelGauge.setThreshold(
      flight.ship.fuel <= 0 ? 'alarm' : fuelFrac < FUEL_CAUTION ? 'caution' : 'nominal',
    );

    this.throttle.setFraction(flight.throttle, `${Math.round(flight.throttle * 100)}%`);

    // Dynamic pressure Q = ½ ρ v². Shows how much drag the ship is fighting.
    // Zero above the atmosphere (alt ≥ ATMOSPHERE.height).
    let q = 0;
    if (dom === flight.planet && alt >= 0 && alt < ATMOSPHERE.height) {
      const density = ATMOSPHERE.surfaceDensity * Math.exp(-alt / ATMOSPHERE.scaleHeight);
      q = 0.5 * density * vel * vel;
    }
    this.q.setValue(q.toFixed(0));
    this.q.setState(q > Q_ALARM ? 'alarm' : 'nominal');

    // SOI label: dominant body via SOI distance to moon center.
    const moonPos = flight.moon.position;
    const md = Math.hypot(
      root.position.x - moonPos.x,
      root.position.y - moonPos.y,
      root.position.z - moonPos.z,
    );
    this.soi.setValue(md < MOON_SOI ? 'LUNA' : 'TERRA');

    this.sas.setValue(flight.sasEnabled ? 'ON' : 'OFF');
    this.sas.setState(flight.sasEnabled ? 'nominal' : 'caution');
  }

  show(): void {
    this.root.style.display = 'block';
  }
  hide(): void {
    this.root.style.display = 'none';
  }
}

/** A gauge with a label to its left, matching the readout label column. */
function gaugeRow(label: string, gauge: Gauge): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'hud-gauge-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'readout__label';
  labelEl.textContent = label;
  row.append(labelEl, gauge.el);
  return row;
}
