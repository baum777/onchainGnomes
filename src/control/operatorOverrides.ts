/**
 * Operator Overrides — Manual control surface
 *
 * Phase-5: Pause lore expansion, reset world-state, force safe mode.
 */

export interface OperatorOverrides {
  pauseLoreExpansion: boolean;
  pauseWorldEvents: boolean;
}

let overrides: OperatorOverrides = {
  pauseLoreExpansion: false,
  pauseWorldEvents: false,
};

export function getOperatorOverrides(): OperatorOverrides {
  return { ...overrides };
}

export function setOperatorOverrides(o: Partial<OperatorOverrides>): void {
  overrides = { ...overrides, ...o };
}
