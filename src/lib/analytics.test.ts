import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  DATASET_SIZE,
  TEAMS,
  Ticket,
  buildSnapshot,
  calculateMetrics,
  filterTickets,
  generateTickets,
  ticketToCsv,
} from "./analytics";

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "SO-000001",
    day: 179,
    date: "2026-08-13",
    team: "Atlas",
    category: "Access",
    channel: "Chat",
    firstResponseMinutes: 10,
    resolutionMinutes: 50,
    csat: 4.5,
    firstContactResolved: true,
    reopened: false,
    ...overrides,
  };
}

describe("synthetic dataset", () => {
  it("is deterministic and contains only anonymous operational dimensions", () => {
    const first = generateTickets(25, 42);
    const second = generateTickets(25, 42);

    expect(first).toEqual(second);
    expect(Object.keys(first[0]).sort()).toEqual(
      [
        "category",
        "channel",
        "csat",
        "date",
        "day",
        "firstContactResolved",
        "firstResponseMinutes",
        "id",
        "reopened",
        "resolutionMinutes",
        "team",
      ].sort(),
    );
    expect(first.every((row) => TEAMS.includes(row.team) && CATEGORIES.includes(row.category))).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  });

  it("filters by period, team, and category", () => {
    const rows = [
      ticket(),
      ticket({ id: "SO-000002", day: 100, team: "Beacon" }),
      ticket({ id: "SO-000003", day: 175, category: "Billing" }),
    ];

    expect(filterTickets(rows, { period: 30, team: "Atlas", category: "Access" }).map((row) => row.id)).toEqual([
      "SO-000001",
    ]);
  });

  it("calculates the documented KPI formulas", () => {
    const metrics = calculateMetrics([
      ticket(),
      ticket({ id: "SO-000002", firstResponseMinutes: 20, resolutionMinutes: 100, csat: 3.5, firstContactResolved: false }),
    ]);

    expect(metrics).toEqual({ volume: 2, slaRate: 50, fcrRate: 50, csat: 4, medianResolution: 75 });
  });

  it("aggregates 100,000 rows within the performance budget", () => {
    const started = performance.now();
    const rows = generateTickets();
    const snapshot = buildSnapshot(rows, { period: 180, team: "all", category: "all" });
    const elapsed = performance.now() - started;

    expect(rows).toHaveLength(DATASET_SIZE);
    expect(snapshot.metrics.volume).toBe(DATASET_SIZE);
    expect(snapshot.insights).toHaveLength(3);
    expect(elapsed).toBeLessThan(2_500);
  });

  it("exports exactly the filtered evidence fields", () => {
    const csv = ticketToCsv([ticket()]);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("ticket_id,date,team,category,channel");
    expect(csv).toContain("SO-000001,2026-08-13,Atlas,Access,Chat");
  });
});
