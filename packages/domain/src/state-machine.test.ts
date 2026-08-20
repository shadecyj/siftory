import { describe, expect, it } from "vitest";
import { InvalidStateTransitionError, canTransition, isTerminalState, transition } from "./index";

describe("SearchRun state machine", () => {
  it("accepts the complete happy path", () => {
    const path = [
      "CREATED",
      "UNDERSTANDING",
      "PLANNING",
      "RETRIEVING",
      "EXTRACTING",
      "EVALUATING",
      "GAP_CHECK",
      "SYNTHESIZING",
      "MATERIALIZING",
      "COMPLETED"
    ] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition(path[index]!, path[index + 1]!)).toBe(true);
    }
  });

  it("rejects shortcuts and resurrection", () => {
    expect(canTransition("CREATED", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "RETRIEVING")).toBe(false);
    expect(canTransition("FAILED", "COMPLETED")).toBe(false);
  });

  it("records completion time through transition", () => {
    const run = { state: "MATERIALIZING" as const, updatedAt: "2026-08-12T00:00:00.000Z" };
    const next = transition(run, "COMPLETED", "2026-08-12T00:01:00.000Z");
    expect(next.completedAt).toBe("2026-08-12T00:01:00.000Z");
    expect(isTerminalState(next.state)).toBe(true);
  });

  it("throws a domain error for invalid transitions", () => {
    const run = { state: "CREATED" as const, updatedAt: "2026-08-12T00:00:00.000Z" };
    expect(() => transition(run, "COMPLETED", "2026-08-12T00:01:00.000Z")).toThrow(
      InvalidStateTransitionError
    );
  });
});
