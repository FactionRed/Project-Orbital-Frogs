// src/ui/flight-prompts.ts
import type { FlightController } from '../flight/flight-controller';
import { Toast } from './components';

/**
 * Contextual on-screen prompts during flight:
 * 1. "Press SPACE to ignite" — shown after launch until the first stage fires.
 * 2. "No fuel remaining" — shown when fuel hits 0 and no orbit/win event has
 *    been achieved, so the player isn't left guessing. Tone is caution while a
 *    later stage can still fire, alarm once nothing is left to burn.
 */
export class FlightPrompts {
  private ignite: Toast;
  private fuel: Toast;
  private firstStageFired = false;

  constructor() {
    this.ignite = new Toast();
    this.ignite.el.id = 'flight-prompt';
    this.fuel = new Toast();
    this.fuel.el.id = 'fuel-prompt';
    // One stack owns the screen position so the toasts flow instead of being
    // placed at hand-tuned offsets that a wrapped line can overrun.
    const stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.append(this.ignite.el, this.fuel.el);
    document.body.appendChild(stack);
  }

  /** Called on launch — reset state and show the ignite prompt. */
  reset(): void {
    this.firstStageFired = false;
    // durationMs 0: these stay until the situation they describe resolves.
    this.ignite.show('Press SPACE to ignite · throttle up gently, pitch east after ~300m', 'info', 0);
    this.fuel.hide();
  }

  /** Called each physics step during flight. */
  update(flight: FlightController): void {
    // Hide the ignite prompt once the user fires their first stage (throttle > 0
    // after having fuel, or staging has advanced).
    if (!this.firstStageFired && (flight.throttle > 0 || flight.currentStageIndex > 0)) {
      this.firstStageFired = true;
      this.ignite.hide();
    }

    // Show the fuel-out prompt when fuel is 0 and the user has already tried to
    // fly (staged or throttled). Don't show it on the pad before first ignition
    // — the ignite prompt covers that case.
    const hasAttempted = this.firstStageFired || flight.currentStageIndex > 0;
    if (hasAttempted && flight.ship.fuel <= 0) {
      const hasLaterStage = flight.currentStageIndex < flight.getStages().length - 1;
      this.fuel.show(
        hasLaterStage
          ? 'No fuel in this stage — press SPACE to stage, or F1 to revert'
          : 'No fuel remaining — press F1 to revert and rebuild',
        hasLaterStage ? 'caution' : 'alarm',
        0,
      );
    } else {
      this.fuel.hide();
    }
  }

  hide(): void {
    this.ignite.hide();
    this.fuel.hide();
  }
}
