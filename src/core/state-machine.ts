// src/core/state-machine.ts
export type GameState = 'INIT' | 'BUILD' | 'FLIGHT' | 'MAP' | 'PAUSED';

export type StateListener = (from: GameState, to: GameState) => void;

/**
 * Legal transitions. Staying in the same state is always a no-op; anything not
 * listed here throws, so a wrong path shows up as a loud failure rather than a
 * screen quietly stuck in the wrong mode.
 *
 * MAP is an overlay on FLIGHT, not an exit from it. PAUSED freezes whichever of
 * BUILD or FLIGHT opened it, and QUIT TO MENU returns to INIT from any of them.
 */
const ALLOWED: Record<GameState, readonly GameState[]> = {
  INIT: ['BUILD'],
  BUILD: ['FLIGHT', 'PAUSED', 'INIT'],
  FLIGHT: ['BUILD', 'MAP', 'PAUSED', 'INIT'],
  MAP: ['FLIGHT', 'BUILD', 'PAUSED', 'INIT'],
  PAUSED: ['BUILD', 'FLIGHT', 'INIT'],
};

export class StateMachine {
  private state: GameState = 'INIT';
  private listeners: StateListener[] = [];
  private _pausedFrom: GameState | null = null;

  get current(): GameState {
    return this.state;
  }

  /** The state the game was in before pausing — where RESUME returns to. */
  get pausedFrom(): GameState | null {
    return this._pausedFrom;
  }

  onTransition(fn: StateListener): void {
    this.listeners.push(fn);
  }

  transition(to: GameState): void {
    if (to === this.state) return;
    if (!ALLOWED[this.state].includes(to)) {
      throw new Error(`Illegal transition ${this.state} → ${to}`);
    }
    const from = this.state;
    if (to === 'PAUSED') this._pausedFrom = from;
    else if (from === 'PAUSED') this._pausedFrom = null;
    this.state = to;
    for (const l of this.listeners) l(from, to);
  }
}
