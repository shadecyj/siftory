import type { RunState } from "./enums";

const transitions: Readonly<Record<RunState, readonly RunState[]>> = {
  CREATED: ["UNDERSTANDING", "CANCELLED"],
  UNDERSTANDING: ["PLANNING", "FAILED", "CANCELLED"],
  PLANNING: ["RETRIEVING", "FAILED", "CANCELLED"],
  RETRIEVING: ["EXTRACTING", "FAILED", "PARTIAL", "CANCELLED"],
  EXTRACTING: ["EVALUATING", "PARTIAL", "CANCELLED"],
  EVALUATING: ["GAP_CHECK", "PARTIAL", "CANCELLED"],
  GAP_CHECK: ["RETRIEVING", "SYNTHESIZING", "PARTIAL", "CANCELLED"],
  SYNTHESIZING: ["MATERIALIZING", "PARTIAL", "CANCELLED"],
  MATERIALIZING: ["COMPLETED", "PARTIAL"],
  COMPLETED: [],
  PARTIAL: ["RETRIEVING"],
  FAILED: ["UNDERSTANDING"],
  CANCELLED: ["RETRIEVING"]
};

export class InvalidStateTransitionError extends Error {
  constructor(from: RunState, to: RunState) {
    super(`Invalid SearchRun state transition: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export function canTransition(from: RunState, to: RunState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

export function isTerminalState(state: RunState): boolean {
  return state === "COMPLETED" || state === "FAILED" || state === "CANCELLED";
}

export interface StatefulRun {
  readonly state: RunState;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
}

export type TransitionedRun<T extends StatefulRun> = T & {
  readonly state: RunState;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly cancelledAt?: string;
};

export function transition<T extends StatefulRun>(run: T, to: RunState, occurredAt: string): TransitionedRun<T> {
  assertTransition(run.state, to);
  return {
    ...run,
    state: to,
    updatedAt: occurredAt,
    ...(to === "COMPLETED" ? { completedAt: occurredAt } : {}),
    ...(to === "CANCELLED" ? { cancelledAt: occurredAt } : {})
  } as TransitionedRun<T>;
}
