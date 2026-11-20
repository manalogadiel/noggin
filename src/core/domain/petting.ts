export const DEFAULT_PETTING_DAILY_CAP = 5;

export interface PettingState {
  happiness: number;
  happinessToday: number;
}

export interface PettingOptions {
  dailyCap?: number;
  maxHappiness?: number;
}

export function applyPettingHappiness(
  state: PettingState,
  delta: number,
  options: PettingOptions = {},
): PettingState {
  const dailyCap = options.dailyCap ?? DEFAULT_PETTING_DAILY_CAP;
  const maxHappiness = options.maxHappiness ?? Number.POSITIVE_INFINITY;

  const remainingDaily = Math.max(0, dailyCap - state.happinessToday);
  const requested = Math.max(0, delta);
  const cappedByDaily = Math.min(requested, remainingDaily);
  const remainingTotal = Math.max(0, maxHappiness - state.happiness);
  const granted = Math.min(cappedByDaily, remainingTotal);

  return {
    happiness: state.happiness + granted,
    happinessToday: state.happinessToday + granted,
  };
}
