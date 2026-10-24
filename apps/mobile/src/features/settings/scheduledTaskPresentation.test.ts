import { describe, expect, it } from "vite-plus/test";

import { repeatLabel, scheduledTaskSummary } from "./scheduledTaskPresentation";

// Local noon keeps a five minute offset on the same calendar day in any time zone.
const NOW = new Date(2026, 0, 15, 12, 0).getTime();
const NEXT_RUN = new Date(NOW + 5 * 60_000).toISOString();

describe("scheduledTaskSummary", () => {
  it("shows the next run for an enabled task", () => {
    expect(
      scheduledTaskSummary(
        { schedule: { type: "interval", everyMs: 900_000 }, enabled: true, nextRunAt: NEXT_RUN },
        NOW,
      ),
    ).toBe("Every 15 minutes · Next run in 5 minutes");
  });

  it("marks a paused task instead of showing its stale next run", () => {
    expect(
      scheduledTaskSummary(
        { schedule: { type: "interval", everyMs: 3_600_000 }, enabled: false, nextRunAt: NEXT_RUN },
        NOW,
      ),
    ).toBe("Every hour · Paused");
  });

  it("omits the next run when the host has none", () => {
    expect(
      scheduledTaskSummary(
        { schedule: { type: "webhook", signature: null }, enabled: true, nextRunAt: null },
        NOW,
      ),
    ).toBe("On webhook");
  });
});

describe("repeatLabel", () => {
  it("names common weekday sets", () => {
    expect(repeatLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(repeatLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(repeatLabel([6, 0])).toBe("Sat, Sun");
  });
});
