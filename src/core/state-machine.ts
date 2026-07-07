// src/core/state-machine.ts
export type GameState = 'INIT' | 'BUILD' | 'FLIGHT' | 'MAP';

export type StateListener = (from: GameState, to: GameState) => void;

export class StateMachine {
  private state: GameState = 'INIT';
  private listeners: StateListener[] = [];

  get current(): GameState {
    return this.state;
  }

  onTransition(fn: StateListener): void {
    this.listeners.push(fn);
  }

  transition(to: GameState): void {
    if (to === this.state) return;
    // MAP is an overlay on FLIGHT — toggling it doesn't exit FLIGHT.
    // We model it by allowing FLIGHT<->MAP transitions freely.
    const from = this.state;
    this.state = to;
    for (const l of this.listeners) l(from, to);
  }
}
