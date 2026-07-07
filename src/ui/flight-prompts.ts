// src/ui/flight-prompts.ts
import type { FlightController } from '../flight/flight-controller';

/**
 * Contextual on-screen prompts during flight:
 * 1. "Press Space to ignite" — shown after launch until the first stage fires.
 * 2. "No fuel remaining — press F1 to revert" — shown when fuel hits 0 and no
 *    orbit/win event has been achieved, so the player isn't left guessing.
 */
export class FlightPrompts {
  private ignitePrompt: HTMLElement;
  private fuelPrompt: HTMLElement;
  private firstStageFired = false;

  constructor() {
    this.ignitePrompt = document.createElement('div');
    this.ignitePrompt.id = 'flight-prompt';
    this.ignitePrompt.innerHTML = 'Press <kbd>Space</kbd> to ignite · throttle up gently, pitch east after ~300m';
    document.body.appendChild(this.ignitePrompt);

    this.fuelPrompt = document.createElement('div');
    this.fuelPrompt.id = 'fuel-prompt';
    this.fuelPrompt.innerHTML = 'No fuel remaining — press <kbd>F1</kbd> to revert and rebuild';
    document.body.appendChild(this.fuelPrompt);
  }

  /** Called on launch — reset state and show the ignite prompt. */
  reset(): void {
    this.firstStageFired = false;
    this.ignitePrompt.style.display = 'block';
    this.fuelPrompt.style.display = 'none';
  }

  /** Called each physics step during flight. */
  update(flight: FlightController): void {
    // Hide ignite prompt once the user fires their first stage (throttle > 0
    // after having fuel, or staging has advanced).
    if (!this.firstStageFired) {
      if (flight.throttle > 0 || flight.currentStageIndex > 0) {
        this.firstStageFired = true;
        this.ignitePrompt.style.display = 'none';
      }
    }

    // Show fuel-out prompt when fuel is 0 and the user has already tried to
    // fly (staged or throttled). Don't show it on the pad before first ignition
    // (the ignite prompt covers that case).
    const hasAttempted = this.firstStageFired || flight.currentStageIndex > 0;
    if (hasAttempted && flight.ship.fuel <= 0) {
      this.fuelPrompt.style.display = 'block';
    } else {
      this.fuelPrompt.style.display = 'none';
    }
  }

  hide(): void {
    this.ignitePrompt.style.display = 'none';
    this.fuelPrompt.style.display = 'none';
  }
}
