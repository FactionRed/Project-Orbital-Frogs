// src/game/science.ts

/**
 * Science point system — tracks earned points, completed experiments, and
 * unlocked tech tree nodes. Persists to localStorage so progress survives
 * across game sessions.
 *
 * Science is earned by:
 * - Achieving milestones (first orbit, first moon landing, safe return)
 * - Running experiments with instruments in different biomes/situations
 * - Recovering the craft (100% value) or transmitting (50% value)
 */

const STORAGE_KEY = 'orbital-frogs-science';

/** A unique key for a completed experiment: `${instrumentId}:${bodyName}:${biome}:${situation}` */
export type ExperimentKey = string;

export interface ScienceState {
  /** Total science points available to spend. */
  points: number;
  /** Total science points ever earned (for display). */
  totalEarned: number;
  /** Set of completed experiment keys (prevents re-earning). */
  completedExperiments: ExperimentKey[];
  /** Set of unlocked tech tree node ids. */
  unlockedNodes: string[];
  /** Set of achieved milestone ids. */
  achievedMilestones: string[];
}

/** Milestone definitions — one-time science rewards. */
export interface Milestone {
  id: string;
  name: string;
  science: number;
}

export const MILESTONES: Milestone[] = [
  { id: 'first-orbit', name: 'First Orbit', science: 10 },
  { id: 'first-moon-landing', name: 'First Moon Landing', science: 25 },
  { id: 'first-safe-return', name: 'First Safe Return', science: 25 },
  { id: 'first-flight', name: 'First Flight', science: 5 },
];

/** Default state — all 5 base parts unlocked, no science earned. */
function defaultState(): ScienceState {
  return {
    points: 0,
    totalEarned: 0,
    completedExperiments: [],
    unlockedNodes: [],
    achievedMilestones: [],
  };
}

/** Load science state from localStorage, or return default if none saved. */
export function loadScienceState(): ScienceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

/** Save science state to localStorage. */
export function saveScienceState(state: ScienceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in some Electron sandboxes — silently ignore.
  }
}

/** Award science points and return the updated state. */
export function awardScience(state: ScienceState, amount: number): ScienceState {
  const newState: ScienceState = {
    ...state,
    points: state.points + amount,
    totalEarned: state.totalEarned + amount,
  };
  saveScienceState(newState);
  return newState;
}

/** Check if a milestone has been achieved. If not, award its science. */
export function checkMilestone(
  state: ScienceState,
  milestoneId: string,
): { state: ScienceState; awarded: number; milestone: Milestone | null } {
  if (state.achievedMilestones.includes(milestoneId)) {
    return { state, awarded: 0, milestone: null };
  }
  const milestone = MILESTONES.find((m) => m.id === milestoneId);
  if (!milestone) return { state, awarded: 0, milestone: null };

  const newState: ScienceState = {
    ...state,
    points: state.points + milestone.science,
    totalEarned: state.totalEarned + milestone.science,
    achievedMilestones: [...state.achievedMilestones, milestoneId],
  };
  saveScienceState(newState);
  return { state: newState, awarded: milestone.science, milestone };
}

/** Build an experiment key from its components. */
export function experimentKey(
  instrumentId: string,
  bodyName: string,
  biome: string,
  situation: string,
): ExperimentKey {
  return `${instrumentId}:${bodyName}:${biome}:${situation}`;
}

/** Check if an experiment has already been completed. */
export function isExperimentCompleted(
  state: ScienceState,
  key: ExperimentKey,
): boolean {
  return state.completedExperiments.includes(key);
}

/**
 * Complete an experiment — award science (with diminishing returns for repeats)
 * and mark it as done.
 *
 * First completion: full value.
 * Repeat completion: 20% of value (incentivizes finding new biomes).
 */
export function completeExperiment(
  state: ScienceState,
  key: ExperimentKey,
  baseValue: number,
): { state: ScienceState; awarded: number } {
  const isRepeat = isExperimentCompleted(state, key);
  const awarded = isRepeat ? Math.round(baseValue * 0.2) : baseValue;
  const newState: ScienceState = {
    ...state,
    points: state.points + awarded,
    totalEarned: state.totalEarned + awarded,
    completedExperiments: isRepeat
      ? state.completedExperiments
      : [...state.completedExperiments, key],
  };
  saveScienceState(newState);
  return { state: newState, awarded };
}

/** Reset all science progress (for debugging / new game). */
export function resetScienceState(): ScienceState {
  const state = defaultState();
  saveScienceState(state);
  return state;
}
